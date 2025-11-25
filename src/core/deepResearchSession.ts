import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { createTaskStore } from '../stores/task-cli';
import type { TaskActions, TaskStore } from '../stores/task.types';
import { buildUserContent, buildUserContentForResearcher } from '../utils/user-contents';
import runQuestionAndAnswerAgent from '../agents/qna';
import runReportPlanAgent from '../agents/report-plan';
import runResearchLeadAgent from '../agents/research-lead';
import runResearchDeepAgent from '../agents/research-deep';
import runResearcherAgent from '../agents/researcher';
import runReporterAgent from '../agents/reporter';
import { createLogHelper } from '../utils/logging';
import { hashStringSHA256 } from '../utils/hash';
import type { LogEntry, LogFunction, QnA, ResearchTask } from '../types';

type LogSink = (entry: LogEntry) => void;
type QnAResponder = (qna: QnA) => Promise<string>;

export interface DeepResearchSessionOptions {
  apiKey: string;
  query: string;
  depth: number;
  wide: number;
  parallelSearch: number;
  thinkingBudget: number;
  reportTone: string;
  minWords: number;
  coreModel: string;
  taskModel: string;
  skipQnA?: boolean;
  autoAnswer?: boolean;
}

export interface DeepResearchSessionCallbacks {
  logSink?: LogSink;
  onPlanChunk?: (chunk: string) => void;
  onReportChunk?: (chunk: string) => void;
  qnaResponder?: QnAResponder;
}

export interface DeepResearchResult {
  id: string;
  query: string;
  qna: QnA[];
  reportPlan: string;
  finalReport: string;
  researchTasks: ResearchTask[];
  logs: LogEntry[];
  sources: string[];
}

export class DeepResearchSession {
  private readonly storeApi = createTaskStore();
  private readonly googleGenAI: GoogleGenAI;
  private researchAbortController: AbortController | null = null;
  private reportAbortController: AbortController | null = null;
  private readonly addLogWithSink: LogFunction;
  private readonly log: ReturnType<typeof createLogHelper>;
  private readonly options: DeepResearchSessionOptions;
  private readonly callbacks: DeepResearchSessionCallbacks;

  constructor(options: DeepResearchSessionOptions, callbacks?: DeepResearchSessionCallbacks) {
    const callbacksValue = callbacks ?? {};
    this.options = options;
    this.callbacks = callbacksValue;

    const store = this.storeApi.getState();
    store.setId(randomUUID());
    store.setQuery(options.query);

    this.googleGenAI = new GoogleGenAI({ apiKey: options.apiKey });

    this.addLogWithSink = (message: string, type?: Parameters<TaskActions['addLog']>[1], level?: Parameters<TaskActions['addLog']>[2], metadata?: Parameters<TaskActions['addLog']>[3]) => {
      store.addLog(message, type, level, metadata);
      const logSink = this.callbacks.logSink;
      if (logSink) {
        const latest = store.logs[store.logs.length - 1];
        if (latest) {
          logSink(latest);
        }
      }
    };

    this.log = createLogHelper(this.addLogWithSink);
  }

  private get taskStore(): TaskStore & TaskActions {
    return this.storeApi.getState();
  }

  public requestCancel() {
    this.researchAbortController?.abort();
    this.reportAbortController?.abort();
  }

  public async run(): Promise<DeepResearchResult> {
    try {
      if (!this.options.skipQnA) {
        await this.generateQnAs();
        await this.resolveQnAResponses();
      } else {
        this.log.warning('Skipping Q&A phase (may reduce report quality)', 'system', 'qna');
      }

      await this.generateReportPlan();
      await this.executeResearchLoop();
      await this.generateFinalReport();

      return {
        id: this.taskStore.id,
        query: this.taskStore.query,
        qna: this.taskStore.qna,
        reportPlan: this.taskStore.reportPlan,
        finalReport: this.taskStore.finalReport,
        researchTasks: this.taskStore.researchTasks,
        logs: this.taskStore.logs,
        sources: this.taskStore.sources,
      };
    } finally {
      this.requestCancel();
    }
  }

  private async generateQnAs() {
    try {
      this.log.startPhase('Q&A Generation');
      this.taskStore.setIsGeneratingQnA(true);

      const userContent = buildUserContent({
        task: this.taskStore,
        includeQuery: true,
        includeQnA: false,
        includePlan: false,
        includeFindings: false,
        includeFiles: true,
      });

      const { questions } = await runQuestionAndAnswerAgent({
        googleGenAI: this.googleGenAI,
        model: this.options.coreModel,
        thinkingBudget: this.options.thinkingBudget,
        userContent,
        addLog: (message, agent) => this.log.agent(message, agent),
      });

      for (const question of questions) {
        const hashedQuestion = await hashStringSHA256(question.question);
        this.taskStore.addQnA({
          id: hashedQuestion,
          q: question.question,
          a: question.suggestedRefinement,
        });
      }

      this.log.endPhase('Q&A Generation', questions.length);
    } finally {
      this.taskStore.setIsGeneratingQnA(false);
    }
  }

  private async resolveQnAResponses() {
    if (this.taskStore.qna.length === 0) return;

    if (this.options.autoAnswer) {
      this.log.info('Auto-answer enabled; using suggested responses', 'system', 'qna');
      return;
    }

    if (!this.callbacks.qnaResponder) {
      throw new Error(
        'Q&A responses required but no responder provided. Enable autoAnswer, skipQnA, or supply qnaResponder.'
      );
    }

    for (const entry of this.taskStore.qna) {
      const answer = await this.callbacks.qnaResponder(entry);
      this.taskStore.updateQnA({ ...entry, a: answer });
    }
  }

  private async generateReportPlan() {
    this.log.startPhase('Report Plan Generation');
    this.taskStore.updateReportPlan('');

    const userContent = buildUserContent({
      task: this.taskStore,
      includeQuery: true,
      includeQnA: true,
      includePlan: false,
      includeFindings: false,
      includeFiles: true,
    });

    const buffer: string[] = [];

    await runReportPlanAgent({
      googleGenAI: this.googleGenAI,
      model: this.options.coreModel,
      thinkingBudget: this.options.thinkingBudget,
      userContent,
      addLog: (message, agent) => this.log.agent(message, agent),
      onStreaming: chunk => {
        buffer.push(chunk);
        const plan = buffer.join('');
        this.taskStore.updateReportPlan(plan);
        this.callbacks.onPlanChunk?.(chunk);
      },
    });

    this.log.endPhase('Report Plan Generation');
  }

  private async executeResearchLoop() {
    this.log.startPhase('Research Task Execution');
    const abortController = new AbortController();
    this.researchAbortController = abortController;

    try {
      for (let tier = 1; tier <= this.options.depth; tier++) {
        if (abortController.signal.aborted) {
          throw new Error('AbortError');
        }

        await this.generateResearchTasks(tier, abortController);
        if (abortController.signal.aborted) {
          throw new Error('AbortError');
        }

        const tierTasks = this.taskStore.getResearchTasksByTier(tier);
        if (tierTasks.length === 0) {
          this.log.success(
            `No tasks required for tier ${tier}. Ending research early.`,
            'system',
            'research'
          );
          this.taskStore.setResearchCompletedEarly(true);
          break;
        }

        await this.runResearchTasks(tier, abortController);
        this.taskStore.setMaxTierReached(tier);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'AbortError') {
        this.log.warning('Research execution cancelled', 'system', 'research');
        return;
      }
      throw error;
    } finally {
      this.researchAbortController = null;
      this.taskStore.setResearchTasksAbortController(null);
      this.log.endPhase('Research Task Execution');
    }
  }

  private async generateResearchTasks(tier: number, abortController: AbortController) {
    if (abortController.signal.aborted) {
      throw new Error('AbortError');
    }

    const existingTasks = this.taskStore.getResearchTasksByTier(tier);
    if (existingTasks.length > 0) {
      return;
    }

    this.log.process(`Generating tier ${tier} research tasks`, 'system', 'task-generation');

    const userContent = buildUserContent({
      task: this.taskStore,
      includeQuery: true,
      includeQnA: true,
      includePlan: true,
      includeFindings: true,
      includeFiles: true,
      limitCount: this.options.wide,
      limitFor: 'tasks',
    });

    const agentParams = {
      googleGenAI: this.googleGenAI,
      model: this.options.coreModel,
      thinkingBudget: this.options.thinkingBudget,
      userContent,
      addLog: (message: string, agent?: string) => this.log.agent(message, agent),
    };

    const { tasks } =
      tier === 1
        ? await runResearchLeadAgent(agentParams, abortController)
        : await runResearchDeepAgent(agentParams, abortController);

    for (const task of tasks) {
      const hashedTask = await hashStringSHA256(task.title + task.direction);
      this.taskStore.addResearchTask({
        id: hashedTask,
        tier,
        title: task.title,
        direction: task.direction,
        target: task.target,
        learning: '',
      });
    }

    this.log.success(`Tier ${tier} produced ${tasks.length} tasks`, 'system', 'task-generation');
  }

  private async runResearchTasks(tier: number, abortController: AbortController) {
    const tasks = this.taskStore.getResearchTasksByTier(tier).filter(task => !task.learning);
    if (tasks.length === 0) {
      return;
    }

    this.log.process(
      `Running ${tasks.length} tasks for tier ${tier}`,
      'researcher-agent',
      'research-execution'
    );

    await this.processWithConcurrency(
      tasks,
      async task => {
        if (abortController.signal.aborted) {
          throw new Error('AbortError');
        }

        this.log.startResearch(task.title);
        this.taskStore.updateResearchTask({ ...task, processing: true });

        try {
          const researcherUserContent = buildUserContentForResearcher({
            researchTask: task,
            taskStore: this.taskStore,
          });

          const { learning, groundingChunks, webSearchQueries, urlsMetadata } =
            await runResearcherAgent({
              userContent: researcherUserContent,
              googleGenAI: this.googleGenAI,
              model: this.options.taskModel,
              thinkingBudget: this.options.thinkingBudget,
              abortController,
            });

          this.taskStore.updateResearchTask({
            ...task,
            processing: false,
            learning,
            groundingChunks,
            webSearchQueries,
            urlsMetadata,
          });

          if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VERTEXAISEARCH_RESOLVER) {
            for (const chunk of groundingChunks) {
              if (chunk?.web?.uri) {
                this.taskStore.addSource(chunk.web.uri);
              }
            }
          }

          this.log.completeResearch(task.title);
        } catch (error) {
          this.taskStore.updateResearchTask({ ...task, processing: false });
          if (error instanceof Error && error.message === 'AbortError') {
            throw error;
          }
          this.log.error(
            `Task failed (${task.title}): ${error}`,
            'researcher-agent',
            'research-execution'
          );
          throw error;
        }
      },
      this.options.parallelSearch
    );
  }

  private async generateFinalReport() {
    this.log.startPhase('Final Report Generation');
    const abortController = new AbortController();
    this.reportAbortController = abortController;
    this.taskStore.updateFinalReport('');

    try {
      const userContent = buildUserContent({
        task: this.taskStore,
        includeQuery: true,
        includeQnA: true,
        includePlan: true,
        includeFindings: true,
        includeFiles: true,
      });

      const buffer: string[] = [];

      await runReporterAgent(
        {
          googleGenAI: this.googleGenAI,
          model: this.options.coreModel,
          thinkingBudget: this.options.thinkingBudget,
          userContent,
          addLog: (message, agent) => this.log.agent(message, agent),
          onStreaming: chunk => {
            buffer.push(chunk);
            const report = buffer.join('');
            this.taskStore.updateFinalReport(report);
            this.callbacks.onReportChunk?.(chunk);
          },
        },
        { tone: this.options.reportTone },
        abortController
      );

      this.log.endPhase('Final Report Generation');
    } catch (error) {
      if (error instanceof Error && error.message === 'AbortError') {
        this.log.warning('Final report generation cancelled', 'system', 'report');
        return;
      }
      throw error;
    } finally {
      this.reportAbortController = null;
    }
  }

  private async processWithConcurrency<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    maxConcurrency: number
  ) {
    const queue = [...items];
    const active = new Set<Promise<void>>();

    const launchNext = () => {
      if (queue.length === 0) return;
      const item = queue.shift();
      if (!item) return;
      const promise = processor(item).finally(() => {
        active.delete(promise);
      });
      active.add(promise);
    };

    while (active.size < maxConcurrency && queue.length > 0) {
      launchNext();
    }

    while (active.size > 0) {
      await Promise.race(active);
      while (active.size < maxConcurrency && queue.length > 0) {
        launchNext();
      }
    }
  }
}


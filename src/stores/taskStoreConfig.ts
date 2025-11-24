import type { StateCreator } from 'zustand';
import type { File } from '@google/genai';
import { getFinalUrlFromVertexAIsearch } from '../utils/vertexaisearch';
import type { TaskActions, TaskStore } from './task.types';

export const defaultTaskStore: TaskStore = {
  id: '',
  query: '',
  currentStep: 0,
  logs: [],
  files: [],
  qna: [],
  isGeneratingQnA: false,
  qnaError: null,
  reportPlan: '',
  reportPlanFeedback: '',
  isGeneratingReportPlan: false,
  reportPlanError: null,
  researchTasks: [],
  researchCompletedEarly: false,
  maxTierReached: 0,
  isGeneratingResearchTasks: false,
  researchTasksError: null,
  finalReport: '',
  isGeneratingFinalReport: false,
  finalReportError: null,
  sources: [],
  sourceQueue: [],
  resolvedUrlQueue: [],
  isProcessingSourceQueue: false,
  isResetting: false,
  researchTasksAbortController: null,
  finalReportAbortController: null,
  isCancelling: false,
};

export const createTaskStoreConfig: StateCreator<TaskStore & TaskActions> = (set, get) => ({
  ...defaultTaskStore,
  setId: (id: string) => set({ id }),
  setQuery: (query: string) => set({ query }),
  setCurrentStep: (currentStep: number) => set({ currentStep }),
  addLog: (message, type = 'info', level = 'medium', metadata) => {
    const logEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      level,
      message: message.trim(),
      agent: metadata?.agent,
      phase: metadata?.phase,
      metadata,
    };
    set(state => ({ logs: [...state.logs, logEntry] }));
  },
  clearLogs: () => set({ logs: [] }),
  addFile: (file: File) => set(state => ({ files: [...state.files, file] })),
  removeFile: (fileName: string) =>
    set(state => ({ files: state.files.filter(file => file.name !== fileName) })),
  clearAllFiles: () => set({ files: [] }),
  addQnA: qna => set(state => ({ qna: [...state.qna, qna] })),
  updateQnA: qna =>
    set(state => ({
      qna: state.qna.map(item => (item.id === qna.id ? qna : item)),
    })),
  setIsGeneratingQnA: isGeneratingQnA => set({ isGeneratingQnA }),
  setQnAError: qnaError => set({ qnaError }),
  updateReportPlan: reportPlan => set({ reportPlan }),
  updateReportPlanFeedback: reportPlanFeedback => set({ reportPlanFeedback }),
  setIsGeneratingReportPlan: isGeneratingReportPlan => set({ isGeneratingReportPlan }),
  setReportPlanError: reportPlanError => set({ reportPlanError }),
  addResearchTask: task =>
    set(state => ({ researchTasks: [...state.researchTasks, task] })),
  updateResearchTask: task =>
    set(state => ({
      researchTasks: state.researchTasks.map(item => (item.id === task.id ? task : item)),
    })),
  getAllResearchTasks: () => get().researchTasks,
  getAllFinishedResearchTasks: () => get().researchTasks.filter(task => task.learning.trim() !== ''),
  getResearchTasksByTier: tier => get().researchTasks.filter(task => task.tier === tier),
  getResearchStatus: () => {
    const allTasks = get().researchTasks;
    const tasksByTier = new Map<number, typeof allTasks>();

    allTasks.forEach(task => {
      const tier = task.tier || 1;
      if (!tasksByTier.has(tier)) {
        tasksByTier.set(tier, []);
      }
      tasksByTier.get(tier)!.push(task);
    });

    const hasFailedTasks = allTasks.some(t => t.processing === false && !t.learning);
    const hasIncompleteTasks = allTasks.some(t => !t.learning);

    let nextTierToProcess = 1;
    const maxPossibleTier = Math.max(...Array.from(tasksByTier.keys()), 0);

    for (let tier = 1; tier <= maxPossibleTier + 1; tier++) {
      const tierTasks = tasksByTier.get(tier) || [];
      const incompleteTasks = tierTasks.filter(t => !t.learning);

      if (tierTasks.length === 0 || incompleteTasks.length > 0) {
        nextTierToProcess = tier;
        break;
      }
    }

    return {
      hasFailedTasks,
      hasIncompleteTasks,
      nextTierToProcess,
      canResume: allTasks.length > 0,
      tasksByTier,
    };
  },
  resetResearchTasks: () => set({ researchTasks: [], researchCompletedEarly: false, maxTierReached: 0 }),
  setResearchCompletedEarly: researchCompletedEarly => set({ researchCompletedEarly }),
  setMaxTierReached: maxTierReached => set({ maxTierReached }),
  setIsGeneratingResearchTasks: isGeneratingResearchTasks => set({ isGeneratingResearchTasks }),
  setResearchTasksError: researchTasksError => set({ researchTasksError }),
  updateFinalReport: finalReport => set({ finalReport }),
  setIsGeneratingFinalReport: isGeneratingFinalReport => set({ isGeneratingFinalReport }),
  setFinalReportError: finalReportError => set({ finalReportError }),
  addSource: vertexUri => {
    const state = get();
    if (!state.sourceQueue.includes(vertexUri)) {
      set(curr => ({ sourceQueue: [...curr.sourceQueue, vertexUri] }));
      if (!state.isProcessingSourceQueue) {
        get().processSourceQueue();
      }
    }
  },
  processSourceQueue: async () => {
    const state = get();
    if (state.isProcessingSourceQueue) {
      return;
    }

    set({ isProcessingSourceQueue: true });

    const MAX_CONCURRENT = 5;
    const activePromises = new Set<Promise<void>>();

    const processResolvedUrls = () => {
      const currentState = get();
      if (currentState.resolvedUrlQueue.length === 0) {
        return;
      }

      const finalUrl = currentState.resolvedUrlQueue[0];
      set(s => ({ resolvedUrlQueue: s.resolvedUrlQueue.slice(1) }));

      if (!get().sources.includes(finalUrl)) {
        set(s => ({ sources: [...s.sources, finalUrl] }));
      }

      if (get().resolvedUrlQueue.length > 0) {
        processResolvedUrls();
      }
    };

    const processVertexUri = async (vertexUri: string) => {
      try {
        const finalUrl = await getFinalUrlFromVertexAIsearch(vertexUri);
        if (finalUrl) {
          set(s => ({ resolvedUrlQueue: [...s.resolvedUrlQueue, finalUrl] }));
          processResolvedUrls();
        }
      } catch (error) {
        console.error('Error processing vertex URI:', error);
      }
    };

    while (true) {
      const currentState = get();
      if (currentState.sourceQueue.length === 0 && activePromises.size === 0) {
        break;
      }

      while (activePromises.size < MAX_CONCURRENT && currentState.sourceQueue.length > 0) {
        const vertexUri = currentState.sourceQueue[0];
        set(s => ({ sourceQueue: s.sourceQueue.slice(1) }));

        const promise = processVertexUri(vertexUri).finally(() => {
          activePromises.delete(promise);
        });

        activePromises.add(promise);
      }

      if (activePromises.size > 0) {
        await Promise.race(activePromises);
      }
    }

    set({ isProcessingSourceQueue: false });
  },
  setIsResetting: isResetting => set({ isResetting }),
  setResearchTasksAbortController: controller => set({ researchTasksAbortController: controller }),
  setFinalReportAbortController: controller => set({ finalReportAbortController: controller }),
  setIsCancelling: isCancelling => set({ isCancelling }),
  cancelResearchTasks: () => {
    const state = get();
    if (state.researchTasksAbortController) {
      set({ isCancelling: true });
      state.researchTasksAbortController.abort();
      set({
        researchTasksAbortController: null,
        isGeneratingResearchTasks: false,
        isCancelling: false,
      });
    }
  },
  cancelFinalReport: () => {
    const state = get();
    if (state.finalReportAbortController) {
      set({ isCancelling: true });
      state.finalReportAbortController.abort();
      set({
        finalReportAbortController: null,
        isGeneratingFinalReport: false,
        isCancelling: false,
      });
    }
  },
  clear: () =>
    set({
      query: '',
      files: [],
      qna: [],
      reportPlan: '',
      reportPlanFeedback: '',
      researchTasks: [],
      researchCompletedEarly: false,
      maxTierReached: 0,
      finalReport: '',
      sources: [],
      currentStep: 0,
      sourceQueue: [],
      resolvedUrlQueue: [],
      isProcessingSourceQueue: false,
      qnaError: null,
      reportPlanError: null,
      researchTasksError: null,
      finalReportError: null,
      isGeneratingQnA: false,
      isGeneratingReportPlan: false,
      isGeneratingResearchTasks: false,
      isGeneratingFinalReport: false,
      researchTasksAbortController: null,
      finalReportAbortController: null,
      isCancelling: false,
    }),
  reset: () => set(defaultTaskStore),
  hasErrors: () => {
    const state = get();
    return Boolean(
      state.qnaError ||
        state.reportPlanError ||
        state.researchTasksError ||
        state.finalReportError
    );
  },
  isAnyGenerating: () => {
    const state = get();
    return (
      state.isGeneratingQnA ||
      state.isGeneratingReportPlan ||
      state.isGeneratingResearchTasks ||
      state.isGeneratingFinalReport ||
      state.isResetting
    );
  },
});


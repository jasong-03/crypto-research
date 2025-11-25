import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Interface as ReadlineInterface } from 'node:readline';
import { DeepResearchSession } from '../core/deepResearchSession';
import type { CliOptions } from './options';

type PromptFn = (prompt: string, defaultValue?: string) => Promise<string>;

export class TerminalDeepResearchSession {
  private readonly prompt?: PromptFn;
  private readonly options: CliOptions;

  constructor(options: CliOptions, readlineInterface?: ReadlineInterface) {
    this.options = options;

    if (readlineInterface) {
      this.prompt = (question: string, defaultValue?: string) =>
        new Promise<string>(resolve => {
          const query = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
          readlineInterface.question(query, (answer: string) => {
            resolve(answer.trim() || defaultValue || '');
          });
        });
    }
  }

  async run() {
    const session = new DeepResearchSession(
      {
        ...this.options,
        autoAnswer: this.options.autoAnswer || !this.options.interactive,
      },
      {
        logSink: (entry: import('../types').LogEntry) => {
          const prefix = entry.type.toUpperCase();
          const phase = entry.phase ? ` (${entry.phase})` : '';
          console.log(
            `[${new Date(entry.timestamp).toISOString()}] [${prefix}]${phase} ${entry.message}`
          );
        },
        onPlanChunk: chunk => process.stdout.write(chunk),
        onReportChunk: chunk => process.stdout.write(chunk),
        qnaResponder: this.prompt
          ? async entry => this.prompt!(entry.q, entry.a)
          : undefined,
      }
    );

    const sigintHandler = () => {
      console.log(`[${new Date().toISOString()}] [SYSTEM] (signal) Cancelling…`);
      session.requestCancel();
    };
    process.once('SIGINT', sigintHandler);

    try {
      const result = await session.run();
      await this.exportOutputs(result);
    } finally {
      process.off('SIGINT', sigintHandler);
    }
  }

  private async exportOutputs(result: Awaited<ReturnType<DeepResearchSession['run']>>) {
    const outputRoot = resolve(process.cwd(), this.options.outputDir);
    await mkdir(outputRoot, { recursive: true });

    const slug = this.options.query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'research';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${timestamp}-${slug}`;

    const files = [
      {
        name: `${baseName}-report-plan.md`,
        content: result.reportPlan || '# Report Plan\n\n_No plan generated._',
      },
      {
        name: `${baseName}-final-report.md`,
        content: result.finalReport || '# Final Report\n\n_No report generated._',
      },
      {
        name: `${baseName}-tasks.json`,
        content: JSON.stringify(result.researchTasks, null, 2),
      },
      {
        name: `${baseName}-logs.json`,
        content: JSON.stringify(result.logs, null, 2),
      },
    ];

    for (const file of files) {
      await writeFile(join(outputRoot, file.name), file.content, 'utf8');
    }

    console.log(`CLI artifacts saved to ${outputRoot}`);
  }
}


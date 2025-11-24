import { settingDefaultValues } from '../stores/setting.defaults';

export interface CliOptions {
  apiKey: string;
  query: string;
  depth: number;
  wide: number;
  parallelSearch: number;
  thinkingBudget: number;
  minWords: number;
  reportTone: string;
  coreModel: string;
  taskModel: string;
  autoAnswer: boolean;
  interactive: boolean;
  outputDir: string;
  skipQnA: boolean;
}

export const CLI_HELP_TEXT = `
Usage: pnpm cli [options]

Options:
  -q, --query <text>           Research query to investigate
      --api-key <key>          Gemini API key (or set GEMINI_API_KEY)
      --core-model <name>      Model for planning/reporting (default: ${settingDefaultValues.coreModel})
      --task-model <name>      Model for task execution (default: ${settingDefaultValues.taskModel})
      --budget <tokens>        Thinking budget tokens (default: ${settingDefaultValues.thinkingBudget})
      --depth <rounds>         How many research tiers to run (default: ${settingDefaultValues.depth})
      --wide <count>           Max tasks per tier (default: ${settingDefaultValues.wide})
      --parallel <count>       Concurrent researchers (default: ${settingDefaultValues.parallelSearch})
      --tone <slug>            Report tone slug (default: ${settingDefaultValues.reportTone})
      --min-words <count>      Minimum word target for report (default: ${settingDefaultValues.minWords})
      --output <dir>           Directory for CLI artifacts (default: cli-output)
      --auto                   Accept suggested Q&A answers without prompting
      --skip-qna               Skip clarification step entirely (not recommended)
      --non-interactive        Disable interactive prompts (requires --query and API key)
  -h, --help                   Show this help message
`.trim();

type PartialCliOptions = Partial<CliOptions>;

export function parseCliArgs(argv: string[]): {
  values: PartialCliOptions;
  helpRequested: boolean;
} {
  const values: PartialCliOptions = {};
  let helpRequested = false;

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];

    if (arg === '--') {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      helpRequested = true;
      continue;
    }

    if (arg === '--auto') {
      values.autoAnswer = true;
      continue;
    }

    if (arg === '--skip-qna') {
      values.skipQnA = true;
      continue;
    }

    if (arg === '--non-interactive') {
      values.interactive = false;
      continue;
    }

    let value: string | undefined;
    if (arg.includes('=')) {
      const [flag, ...rest] = arg.split('=');
      arg = flag;
      value = rest.join('=');
    } else {
      if (i + 1 < argv.length) {
        value = argv[++i];
      }
    }

    if (!value) {
      continue;
    }

    switch (arg) {
      case '--query':
      case '-q':
        values.query = value;
        break;
      case '--api-key':
        values.apiKey = value;
        break;
      case '--core-model':
        values.coreModel = value;
        break;
      case '--task-model':
        values.taskModel = value;
        break;
      case '--budget':
        values.thinkingBudget = Number(value);
        break;
      case '--depth':
        values.depth = Number(value);
        break;
      case '--wide':
        values.wide = Number(value);
        break;
      case '--parallel':
        values.parallelSearch = Number(value);
        break;
      case '--tone':
        values.reportTone = value;
        break;
      case '--min-words':
        values.minWords = Number(value);
        break;
      case '--output':
        values.outputDir = value;
        break;
      default:
        break;
    }
  }

  return { values, helpRequested };
}

export function resolveCliOptions(partial: PartialCliOptions): CliOptions {
  return {
    apiKey: partial.apiKey || process.env.GEMINI_API_KEY || '',
    query: partial.query || '',
    depth: partial.depth || settingDefaultValues.depth,
    wide: partial.wide || settingDefaultValues.wide,
    parallelSearch: partial.parallelSearch || settingDefaultValues.parallelSearch,
    thinkingBudget: partial.thinkingBudget || settingDefaultValues.thinkingBudget,
    minWords: partial.minWords || settingDefaultValues.minWords,
    reportTone: partial.reportTone || settingDefaultValues.reportTone,
    coreModel: partial.coreModel || settingDefaultValues.coreModel,
    taskModel: partial.taskModel || settingDefaultValues.taskModel,
    autoAnswer: partial.autoAnswer ?? false,
    interactive: partial.interactive ?? true,
    outputDir: partial.outputDir || 'cli-output',
    skipQnA: partial.skipQnA ?? false,
  };
}


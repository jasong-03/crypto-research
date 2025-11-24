const PROMPT_NAMES = [
  'qna',
  'report-plan',
  'reporter',
  'research-deep',
  'research-lead',
  'researcher',
] as const;

type PromptName = (typeof PROMPT_NAMES)[number];

const isNodeRuntime =
  typeof process !== 'undefined' && !!process.versions?.node && !process.env?.VITE_USE_BROWSER_PROMPTS;

const promptCache: Record<string, string> = {};

if (isNodeRuntime) {
  const [{ readFileSync }, { resolve, dirname }, { fileURLToPath }] = await Promise.all([
    import('node:fs'),
    import('node:path'),
    import('node:url'),
  ]);
  const baseDir = dirname(fileURLToPath(import.meta.url));
  for (const prompt of PROMPT_NAMES) {
    const filePath = resolve(baseDir, `../prompts/${prompt}.md`);
    promptCache[prompt] = readFileSync(filePath, 'utf8');
  }
} else {
  const browserLoaders: Record<PromptName, () => Promise<{ default: string }>> = {
    qna: () => import('../prompts/qna.md?raw'),
    'report-plan': () => import('../prompts/report-plan.md?raw'),
    reporter: () => import('../prompts/reporter.md?raw'),
    'research-deep': () => import('../prompts/research-deep.md?raw'),
    'research-lead': () => import('../prompts/research-lead.md?raw'),
    researcher: () => import('../prompts/researcher.md?raw'),
  };

  await Promise.all(
    PROMPT_NAMES.map(async name => {
      const module = await browserLoaders[name]();
      promptCache[name] = module.default;
    })
  );
}

/**
 * Gets a markdown prompt content as a string
 * @param promptName The name of the prompt file (without .md extension)
 * @returns The content of the markdown file as a string
 */
export function loadPrompt(promptName: string): string {
  const prompt = promptCache[promptName];
  if (!prompt) {
    throw new Error(
      `Prompt '${promptName}' not found. Available prompts: ${PROMPT_NAMES.join(', ')}`
    );
  }
  return prompt;
}

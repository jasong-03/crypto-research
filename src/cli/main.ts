#!/usr/bin/env node
/// <reference types="node" />

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { CLI_HELP_TEXT, parseCliArgs, resolveCliOptions } from './options';
import { TerminalDeepResearchSession } from './session';

async function ensureOption(
  label: string,
  current: string,
  rl: ReturnType<typeof createInterface> | undefined
): Promise<string> {
  if (current) return current;
  if (!rl) {
    throw new Error(`${label} is required. Provide it via CLI flags or enable interactive mode.`);
  }
  const answer = (await rl.question(`${label}: `)).trim();
  if (!answer) {
    throw new Error(`${label} cannot be empty.`);
  }
  return answer;
}

async function main() {
  const { values, helpRequested } = parseCliArgs(process.argv.slice(2));

  if (helpRequested) {
    console.log(CLI_HELP_TEXT);
    return;
  }

  const options = resolveCliOptions(values);
  const rl = options.interactive ? createInterface({ input: stdin, output: stdout }) : undefined;

  try {
    options.apiKey = await ensureOption('Gemini API key', options.apiKey, rl);
    options.query = await ensureOption('Research query', options.query, rl);

    const session = new TerminalDeepResearchSession(options, rl);
    await session.run();
  } finally {
    await rl?.close();
  }
}

main().catch(error => {
  console.error('CLI session failed:', error);
  process.exitCode = 1;
});


import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DeepResearchSession } from '../src/core/deepResearchSession';
import { settingDefaultValues } from '../src/stores/setting.defaults';

function getQueryParam(req: VercelRequest): string | undefined {
  if (req.method === 'POST') {
    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        return parsed?.query;
      } catch {
        return undefined;
      }
    }
    return req.body?.query;
  }

  const value = req.query?.query;
  if (Array.isArray(value)) {
    return value[0];
  }
  return value as string | undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = getQueryParam(req)?.trim();
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured');
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY is not configured',
      message: 'Please set GEMINI_API_KEY environment variable in Vercel settings'
    });
  }

  try {
    console.log('Starting research session for query:', query);
    
    const session = new DeepResearchSession(
      {
        apiKey,
        query,
        depth: settingDefaultValues.depth,
        wide: settingDefaultValues.wide,
        parallelSearch: settingDefaultValues.parallelSearch,
        thinkingBudget: settingDefaultValues.thinkingBudget,
        reportTone: settingDefaultValues.reportTone,
        minWords: settingDefaultValues.minWords,
        coreModel: settingDefaultValues.coreModel,
        taskModel: settingDefaultValues.taskModel,
        skipQnA: true,
        autoAnswer: true,
      },
      {
        logSink: (entry) => {
          console.log(`[${entry.type}] ${entry.message}`);
        },
      }
    );

    console.log('Running research session...');
    const result = await session.run();
    console.log('Research session completed');

    return res.status(200).json({
      query: result.query,
      id: result.id,
      reportPlan: result.reportPlan,
      finalReport: result.finalReport,
      qna: result.qna,
      tasks: result.researchTasks,
      logs: result.logs,
      sources: result.sources,
    });
  } catch (error) {
    console.error('API research run failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : undefined,
    });

    return res.status(500).json({
      error: 'Research execution failed',
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: errorStack }),
    });
  }
}


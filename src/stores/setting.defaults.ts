export const settingDefaultValues = {
  apiKey: '',
  coreModel: 'gemini-2.5-pro',
  taskModel: 'gemini-2.5-flash',
  thinkingBudget: 2048,
  depth: 3,
  wide: 7,
  parallelSearch: 3,
  reportTone: 'journalist-tone',
  minWords: 6000,
  modelList: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  isApiKeyValid: false,
  isApiKeyValidating: false,
} as const;


import { GoogleGenAI } from '@google/genai';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settingDefaultValues } from './setting.defaults';

export interface SettingStore {
  apiKey: string;
  coreModel: string;
  taskModel: string;
  thinkingBudget: number;
  depth: number;
  wide: number;
  parallelSearch: number;
  reportTone: string;
  minWords: number;
  modelList: string[];
  isApiKeyValid: boolean;
  isApiKeyValidating: boolean;
}

interface SettingActions {
  update: (values: Partial<SettingStore>) => void;
  reset: () => void;
  validateSettings: () => boolean;
  validateApiKey: (apiKey: string) => Promise<void>;
}

const createDefaultValues = (): SettingStore => ({
  ...settingDefaultValues,
  modelList: [...settingDefaultValues.modelList],
});

export const useSettingStore = create(
  persist<SettingStore & SettingActions>(
    (set, get) => ({
      ...createDefaultValues(),
      update: values => set(values),
      reset: () => set(createDefaultValues()),
      validateSettings: () => {
        const state = get();
        return !!(
          state.apiKey.trim() &&
          state.thinkingBudget > 0 &&
          state.depth > 0 &&
          state.wide > 0 &&
          state.parallelSearch > 0 &&
          state.minWords > 0
        );
      },
      validateApiKey: async (apiKey: string) => {
        const trimmedKey = apiKey.trim();

        if (!trimmedKey) {
          set({
            isApiKeyValid: false,
            modelList: [...settingDefaultValues.modelList],
            isApiKeyValidating: false,
          });
          return;
        }

        // Don't set validating state here - let the component handle it
        // This prevents race conditions with rapid state updates

        try {
          const genAI = new GoogleGenAI({ apiKey: trimmedKey });
          const listModels = await genAI.models.list();

          const models = listModels.page;
          const modelNames = models.map(model => {
            if (model?.name) {
              return model?.name.replace('models/', '');
            } else {
              return '';
            }
          });

          // filter models start with 'gemini-{number}'
          const filteredModelNames = modelNames.filter(name => /^gemini-\d+/.test(name));

          // Sort by model name desc
          filteredModelNames.sort().reverse();

          // Get current state to check if selected models are still valid
          const currentState = get();
          const updates: Partial<SettingStore> = {
            modelList: filteredModelNames,
            isApiKeyValid: true,
            isApiKeyValidating: false,
          };

          // Reset model selections if they're not in the new list
          if (!filteredModelNames.includes(currentState.coreModel)) {
            updates.coreModel = filteredModelNames[0] || settingDefaultValues.coreModel;
          }
          if (!filteredModelNames.includes(currentState.taskModel)) {
            updates.taskModel = filteredModelNames[0] || settingDefaultValues.taskModel;
          }

          set(updates);
        } catch (error) {
          console.error('API key validation failed:', error);
          set({
            modelList: [...settingDefaultValues.modelList],
            isApiKeyValid: false,
            isApiKeyValidating: false,
          });
        }
      },
    }),
    { name: 'setting' }
  )
);

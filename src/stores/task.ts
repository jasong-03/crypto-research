import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskActions, TaskStore } from './task.types';
import { createTaskStoreConfig } from './taskStoreConfig';

export type { LogEntry, LogLevel, LogMetadata, LogType } from '../types';
export type { TaskStore, TaskActions } from './task.types';

export const useTaskStore = create(
  persist<TaskStore & TaskActions>(createTaskStoreConfig, {
      name: 'research',
  })
);

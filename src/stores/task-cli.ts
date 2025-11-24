import { createStore } from 'zustand/vanilla';
import type { TaskActions, TaskStore } from './task.types';
import { createTaskStoreConfig } from './taskStoreConfig';

export const createTaskStore = () =>
  createStore<TaskStore & TaskActions>(createTaskStoreConfig);


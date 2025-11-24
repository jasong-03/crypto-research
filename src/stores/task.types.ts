import type { File } from '@google/genai';
import type { LogEntry, LogLevel, LogMetadata, LogType, QnA, ResearchTask } from '../types';

export interface TaskStore {
  id: string;
  query: string;
  currentStep: number;
  logs: LogEntry[];
  files: File[];
  qna: QnA[];
  isGeneratingQnA: boolean;
  qnaError: string | null;
  reportPlan: string;
  reportPlanFeedback: string;
  isGeneratingReportPlan: boolean;
  reportPlanError: string | null;
  researchTasks: ResearchTask[];
  researchCompletedEarly: boolean;
  maxTierReached: number;
  isGeneratingResearchTasks: boolean;
  researchTasksError: string | null;
  finalReport: string;
  isGeneratingFinalReport: boolean;
  finalReportError: string | null;
  sources: string[];
  sourceQueue: string[];
  resolvedUrlQueue: string[];
  isProcessingSourceQueue: boolean;
  isResetting: boolean;
  researchTasksAbortController: AbortController | null;
  finalReportAbortController: AbortController | null;
  isCancelling: boolean;
}

export interface TaskActions {
  setId: (id: string) => void;
  setQuery: (query: string) => void;
  setCurrentStep: (step: number) => void;
  addLog: (log: string, type?: LogType, level?: LogLevel, metadata?: LogMetadata) => void;
  clearLogs: () => void;
  addFile: (file: File) => void;
  removeFile: (fileName: string) => void;
  clearAllFiles: () => void;
  addQnA: (qna: QnA) => void;
  updateQnA: (qna: QnA) => void;
  setIsGeneratingQnA: (isGenerating: boolean) => void;
  setQnAError: (error: string | null) => void;
  updateReportPlan: (plan: string) => void;
  updateReportPlanFeedback: (feedback: string) => void;
  setIsGeneratingReportPlan: (isGenerating: boolean) => void;
  setReportPlanError: (error: string | null) => void;
  addResearchTask: (task: ResearchTask) => void;
  updateResearchTask: (task: ResearchTask) => void;
  getAllResearchTasks: () => ResearchTask[];
  getAllFinishedResearchTasks: () => ResearchTask[];
  getResearchTasksByTier: (tier: number) => ResearchTask[];
  getResearchStatus: () => {
    hasFailedTasks: boolean;
    hasIncompleteTasks: boolean;
    nextTierToProcess: number;
    canResume: boolean;
    tasksByTier: Map<number, ResearchTask[]>;
  };
  resetResearchTasks: () => void;
  setResearchCompletedEarly: (completed: boolean) => void;
  setMaxTierReached: (tier: number) => void;
  setIsGeneratingResearchTasks: (isGenerating: boolean) => void;
  setResearchTasksError: (error: string | null) => void;
  updateFinalReport: (report: string) => void;
  setIsGeneratingFinalReport: (isGenerating: boolean) => void;
  setFinalReportError: (error: string | null) => void;
  addSource: (vertexUri: string) => void;
  processSourceQueue: () => Promise<void>;
  setIsResetting: (isResetting: boolean) => void;
  setResearchTasksAbortController: (controller: AbortController | null) => void;
  setFinalReportAbortController: (controller: AbortController | null) => void;
  setIsCancelling: (isCancelling: boolean) => void;
  cancelResearchTasks: () => void;
  cancelFinalReport: () => void;
  clear: () => void;
  reset: () => void;
  hasErrors: () => boolean;
  isAnyGenerating: () => boolean;
}



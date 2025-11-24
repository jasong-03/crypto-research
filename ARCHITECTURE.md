# Deep Research OSS Architecture

## Tech Stack & Entry Points
- **Framework**: React 19 + TypeScript, bundled with Vite (`src/main.tsx` mounts `App` and routes `/` plus `/report/:id`).
- **UI**: MUI components with Tailwind utility classes layered via `StyledEngineProvider`.
- **State**: Zustand with persistence in localStorage (`useTaskStore`, `useSettingStore`, `useGlobalStore`, `useQueryLibraryStore`).
- **LLM Client**: `@google/genai` using Gemini models; prompts are markdown files loaded via Vite `?raw` (`src/prompts/*`, `src/utils/prompt-loader.ts`).
- **Styling/markdown**: `react-markdown` + `remark-gfm`/`remark-math`/`rehype-katex` for report rendering.

## State Model
- `src/stores/setting.ts`: API key, model choices (`coreModel` for planning/reporting, `taskModel` for web research), thinking budget, depth/wide/parallelism, tone; validates API key by listing models.
- `src/stores/task.ts`: Single research session (persisted as `research`) with query, files, QnA, report plan, research tasks (tiers), final report, logs, sources, abort controllers, and derived getters (`getResearchStatus`, `getAllFinishedResearchTasks`, `hasErrors`, etc.). Also manages vertex grounding URL resolution queue.
- `src/stores/global.ts`: Dialog visibility for settings/logs/query library.
- `src/stores/queryLibrary.ts`: Saved/built-in query templates, search/filter toggles.

## Core Orchestration (`src/hooks/useDeepResearch.ts`)
- Central hook that wires settings + task store into the agent pipeline using a single `GoogleGenAI` client.
- **Logging**: Local helpers wrap `taskStore.addLog` to classify phases/agents; `ProcessLogs` renders them live.
- **Q&A generation**: Builds user content (`buildUserContent`) with query/files, streams JSON from `qna` agent, hashes question text for stable IDs, persists to store.
- **Report plan**: Streams markdown from `report-plan` agent using a smooth streaming buffer; stored as `reportPlan`.
- **Task generation & execution**:
  - Tier 1 uses `research-lead` agent; deeper tiers use `research-deep` agent. Each takes current query/QnA/plan/findings and optional limit (`wide`) to keep task counts in check.
  - Tasks are hashed, tagged with tier/target (WEB/ACADEMIC/SOCIAL/FILE_UPLOAD), inserted into store; early exit if no tasks generated.
  - Execution uses `runResearcherAgent` concurrently (respecting `parallelSearch`). Researcher agent is configured with `googleSearch`, `urlContext`, `codeExecution` tools and returns `learning`, `groundingChunks`, `webSearchQueries`, `urlsMetadata`. Results update tasks; sources are queued for URL resolution when a resolver is configured.
  - Abort handling: tier generation and execution honor `AbortController`; store keeps controllers for cancellation buttons.
  - Resume logic: `getResearchStatus` detects failed/incomplete tasks and next tier to run; UI offers resume/restart.
- **Final report**: Streams markdown from `reporter` agent (tools: `codeExecution`) with selected tone (`tones.ts`), using adaptive streaming buffer into `finalReport`.
- **Files**: Upload/delete/reset helpers call Gemini File API; files can be attached to prompts (and used exclusively when task target is `FILE_UPLOAD`).
- **Reset**: Optionally deletes uploaded files then resets task store.

## Agents (`src/agents/*`)
- Shared system instructions: current datetime + "respond in user language" (`src/utils/system-instructions.ts`).
- **qna**: Produces clarifying questions + suggested answers (JSON schema enforced).
- **report-plan**: Streams structured plan text; can search the web.
- **research-lead / research-deep**: Produce task lists (title/direction/target) with abort awareness.
- **researcher**: Single-call content generation with tools; retries up to 3 times; returns grounding/search metadata.
- **reporter**: Streams final report, logs thoughts/code blocks, inlines base64 images; enforces tone.

## UI Flow (`src/App.tsx`)
1. **Research Query** (`components/Research/Query.tsx`): capture query + optional file upload; starts QnA generation; seeds `taskStore.id`.
2. **Clarification** (`components/Research/QnA.tsx`): user answers generated questions; triggers report plan.
3. **Research Plan** (`components/Research/ReportPlan.tsx`): shows streamed plan, allows manual edits, starts multi-round research; supports stop/restart.
4. **Data Collection** (`components/Research/Tasks.tsx`): shows tasks grouped by tier, progress, allows cancel; once all tasks done, enables report generation.
5. **Final Report** (`components/Research/Report.tsx`): streams report, supports edit/regenerate/download/open-in-new-window; word count via `utils/word-count.ts`.
- **References** (`components/Research/References.tsx`): deduplicates sources from resolved URLs or grounding chunks.
- **Stepper** (`components/Research/ResearchStepper.tsx`): sticky indicator reflecting store `currentStep`, scrolls to sections.
- **Process Logs**: floating console fed by `taskStore.logs`.
- **Dialogs**: settings (API key/models/tone/budgets), query library (templates from `src/templates`), tone info, etc.

## Prompt & Input Construction
- Prompts live in `src/prompts/*.md`; loaded via `loadPrompt` and injected as system instructions.
- `buildUserContent` wraps pieces in XML-like tags `<QUERY>`, `<QNA>`, `<REPORT_PLAN>`, `<FINDINGS>` plus optional file parts; `buildUserContentForResearcher` adds scope hints based on task target.
- Vertex grounding URLs can be de-obfuscated via optional resolver (`VITE_VERTEXAISEARCH_RESOLVER`); queue processor keeps `sources` unique.

## Runtime Flow (Happy Path)
1) User sets API key/models in settings (validated via model listing).  
2) Enter query (+files) → `generateQnAs` runs `qna` agent → user answers.  
3) `generateReportPlan` streams plan.  
4) `startResearchTasks` loops tiers up to `depth`: generate tasks (`wide` cap) → run tasks concurrently (`parallelSearch`) → mark findings. Early completion if a tier yields zero tasks.  
5) `generateFinalReport` streams report with chosen tone; UI enables download/print/open.  
6) References assembled from grounding/URL metadata; logs remain for review; data persisted locally until reset.

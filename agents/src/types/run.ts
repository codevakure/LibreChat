// src/types/run.ts
import type * as z from 'zod';
import type { BaseMessage } from '@langchain/core/messages';
import type { StructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import type {
  BaseCallbackHandler,
  CallbackHandlerMethods,
} from '@langchain/core/callbacks/base';
import type * as graph from '@/graphs/Graph';
import type * as s from '@/types/stream';
import type * as e from '@/common/enum';
import type * as g from '@/types/graph';
import type * as l from '@/types/llm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodObjectAny = z.ZodObject<any, any, any, any>;
export type BaseGraphConfig = {
  type?: 'standard';
  llmConfig: l.LLMConfig;
  provider?: e.Providers;
  clientOptions?: l.ClientOptions;
};
export type StandardGraphConfig = BaseGraphConfig &
  Omit<g.StandardGraphInput, 'provider' | 'clientOptions'>;

export type RunTitleOptions = {
  inputText: string;
  provider: e.Providers;
  contentParts: (s.MessageContentComplex | undefined)[];
  titlePrompt?: string;
  skipLanguage?: boolean;
  clientOptions?: l.ClientOptions;
  chainOptions?: Partial<RunnableConfig> | undefined;
  omitOptions?: Set<string>;
  titleMethod?: e.TitleMethod;
  titlePromptTemplate?: string;
};

export interface AgentStateChannels {
  messages: BaseMessage[];
  next: string;
  [key: string]: unknown;
  instructions?: string;
  additional_instructions?: string;
}

export interface Member {
  name: string;
  systemPrompt: string;
  tools: StructuredTool[];
  llmConfig: l.LLMConfig;
}

export type CollaborativeGraphConfig = {
  type: 'collaborative';
  members: Member[];
  supervisorConfig: { systemPrompt?: string; llmConfig: l.LLMConfig };
};

export type TaskManagerGraphConfig = {
  type: 'taskmanager';
  members: Member[];
  supervisorConfig: { systemPrompt?: string; llmConfig: l.LLMConfig };
};

export type RunConfig = {
  runId: string;
  graphConfig:
    | StandardGraphConfig
    | CollaborativeGraphConfig
    | TaskManagerGraphConfig;
  customHandlers?: Record<string, g.EventHandler>;
  returnContent?: boolean;
};

export type ProvidedCallbacks =
  | (BaseCallbackHandler | CallbackHandlerMethods)[]
  | undefined;

export type TokenCounter = (message: BaseMessage) => number;
export type EventStreamOptions = {
  callbacks?: graph.ClientCallbacks;
  keepContent?: boolean;
  /* Context Management */
  maxContextTokens?: number;
  tokenCounter?: TokenCounter;
  indexTokenCountMap?: Record<string, number>;
};

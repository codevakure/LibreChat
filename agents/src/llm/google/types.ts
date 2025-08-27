import {
  CodeExecutionTool,
  FunctionDeclarationsTool as GoogleGenerativeAIFunctionDeclarationsTool,
  GoogleSearchRetrievalTool,
} from '@google/generative-ai';
import { BindToolsInput } from '@langchain/core/language_models/chat_models';

export type GoogleGenerativeAIToolType =
  | BindToolsInput
  | GoogleGenerativeAIFunctionDeclarationsTool
  | CodeExecutionTool
  | GoogleSearchRetrievalTool;

/** Enum for content modality types */
enum Modality {
  MODALITY_UNSPECIFIED = 'MODALITY_UNSPECIFIED',
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
}

/** Interface for modality token count */
interface ModalityTokenCount {
  modality: Modality;
  tokenCount: number;
}

/** Main interface for Gemini API usage metadata */
export interface GeminiApiUsageMetadata {
  promptTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
  candidatesTokenCount?: number;
  toolUsePromptTokenCount?: number;
  cachedContentTokenCount?: number;
  promptTokensDetails: ModalityTokenCount[];
  candidatesTokensDetails?: ModalityTokenCount[];
  cacheTokensDetails?: ModalityTokenCount[];
  toolUsePromptTokensDetails?: ModalityTokenCount[];
  trafficType?: string;
}

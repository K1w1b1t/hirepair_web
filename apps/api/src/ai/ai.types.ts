import type { AiExecutionContext } from '../operational/ai-budget.service';
export type AiProvider = 'gemini' | 'groq-120b' | 'groq-20b';
export interface AiTextGenerationRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  context: AiExecutionContext;
  responseSchema: Record<string, unknown>;
}
export interface AiTextGenerationResult {
  text: string;
  provider: AiProvider;
  model: string;
}

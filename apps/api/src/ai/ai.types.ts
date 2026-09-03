export type AiProvider = 'gemini' | 'groq-70b' | 'groq-8b';

/**
 * Entrada independente de provedor. O contexto vem inteiro a cada chamada para
 * que uma comutação nao interrompa a conversa do candidato.
 */
export interface AiTextGenerationRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AiTextGenerationResult {
  text: string;
  provider: AiProvider;
  model: string;
}

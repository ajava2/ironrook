import type { AISettings } from '../settings';
import { GeminiClient } from './gemini';
import { OllamaClient } from './ollama';
import { OpenAICompatClient } from './openaiCompat';
import type { AIClient } from './types';

export type { AIClient, AIImage, AIMessage } from './types';
export { AIError } from './types';

/** null = no hay proveedor configurado → la app usa el modo simulación local. */
export function createAIClient(s: AISettings): AIClient | null {
  switch (s.provider) {
    case 'gemini':
      return s.geminiKey.trim() ? new GeminiClient(s.geminiKey.trim(), s.geminiModel) : null;
    case 'groq':
      return s.groqKey.trim()
        ? new OpenAICompatClient('Groq', 'https://api.groq.com/openai/v1', s.groqKey.trim(), s.groqModel, s.groqVisionModel)
        : null;
    case 'ollama':
      return s.ollamaUrl.trim() ? new OllamaClient(s.ollamaUrl.trim(), s.ollamaModel, s.ollamaVisionModel) : null;
    case 'local':
      return null;
  }
}

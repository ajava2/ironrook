/**
 * Configuración sensible (API keys, URLs de servidores propios). Vive SOLO en localStorage:
 * no entra en IndexedDB, ni en las copias de seguridad, ni en el repositorio.
 */
export type AIProviderId = 'gemini' | 'groq' | 'ollama' | 'local';

export interface AISettings {
  provider: AIProviderId;
  geminiKey: string;
  geminiModel: string;
  groqKey: string;
  groqModel: string;
  groqVisionModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaVisionModel: string;
  pocketbaseUrl: string;
  pocketbaseEmail: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  groqKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  groqVisionModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  ollamaVisionModel: 'llava',
  pocketbaseUrl: '',
  pocketbaseEmail: '',
};

const KEY = 'fit.aiSettings';

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_AI_SETTINGS, ...(JSON.parse(raw) as Partial<AISettings>) } : DEFAULT_AI_SETTINGS;
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAISettings(s: AISettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

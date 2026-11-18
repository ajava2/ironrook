import { AIError, postJson, type AIClient, type AIImage, type AIMessage } from './types';

interface OllamaChat {
  message?: { content?: string };
}

/**
 * Ollama local. Para llamarlo desde el navegador hay que permitir el origen de la app:
 *   OLLAMA_ORIGINS="https://<usuario>.github.io,http://localhost:5173" ollama serve
 */
export class OllamaClient implements AIClient {
  readonly label: string;

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly visionModel: string,
  ) {
    this.label = `Ollama · ${model}`;
  }

  private async call(body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const data = (await postJson(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, { stream: false, ...body }, {}, signal)) as OllamaChat;
    const text = data.message?.content ?? '';
    if (!text) throw new AIError('Ollama devolvió una respuesta vacía');
    return text;
  }

  chat(messages: AIMessage[], signal?: AbortSignal): Promise<string> {
    return this.call({ model: this.model, messages }, signal);
  }

  json(system: string, prompt: string, image?: AIImage, signal?: AbortSignal): Promise<string> {
    return this.call(
      {
        model: image ? this.visionModel : this.model,
        format: 'json',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt, ...(image ? { images: [image.base64] } : {}) },
        ],
      },
      signal,
    );
  }
}

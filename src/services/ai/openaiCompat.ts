import { AIError, postJson, type AIClient, type AIImage, type AIMessage } from './types';

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

/** Cliente para APIs con formato OpenAI /chat/completions (Groq, OpenRouter, LM Studio...). */
export class OpenAICompatClient implements AIClient {
  constructor(
    readonly label: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly visionModel: string,
  ) {}

  private async complete(body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const data = (await postJson(`${this.baseUrl}/chat/completions`, body, { Authorization: `Bearer ${this.apiKey}` }, signal)) as ChatCompletion;
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new AIError(`${this.label} devolvió una respuesta vacía`);
    return text;
  }

  chat(messages: AIMessage[], signal?: AbortSignal): Promise<string> {
    return this.complete({ model: this.model, messages, temperature: 0.6, max_tokens: 1200 }, signal);
  }

  json(system: string, prompt: string, image?: AIImage, signal?: AbortSignal): Promise<string> {
    const userContent = image
      ? [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
        ]
      : prompt;
    return this.complete(
      {
        model: image ? this.visionModel : this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      },
      signal,
    );
  }
}

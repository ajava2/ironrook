import { AIError, postJson, type AIClient, type AIImage, type AIMessage } from './types';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiClient implements AIClient {
  readonly label: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'gemini-2.5-flash',
  ) {
    this.label = `Gemini · ${model}`;
  }

  private async generate(body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const data = (await postJson(`${ENDPOINT}/${this.model}:generateContent`, body, { 'x-goog-api-key': this.apiKey }, signal)) as GeminiResponse;
    if (data.promptFeedback?.blockReason) throw new AIError(`Gemini bloqueó la petición: ${data.promptFeedback.blockReason}`);
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new AIError('Gemini devolvió una respuesta vacía');
    return text;
  }

  chat(messages: AIMessage[], signal?: AbortSignal): Promise<string> {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    return this.generate(
      {
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } },
      },
      signal,
    );
  }

  json(system: string, prompt: string, image?: AIImage, signal?: AbortSignal): Promise<string> {
    const parts: Record<string, unknown>[] = [];
    if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    parts.push({ text: prompt });
    return this.generate(
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      signal,
    );
  }
}

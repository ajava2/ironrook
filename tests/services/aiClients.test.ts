import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiClient } from '../../src/services/ai/gemini';
import { OllamaClient } from '../../src/services/ai/ollama';
import { OpenAICompatClient } from '../../src/services/ai/openaiCompat';
import { AIError } from '../../src/services/ai/types';

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

function lastRequest(fn: ReturnType<typeof mockFetch>) {
  const [url, init] = fn.mock.calls.at(-1)! as unknown as [string, RequestInit];
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
}

const image = { mimeType: 'image/jpeg', base64: 'AAAA' };

afterEach(() => vi.unstubAllGlobals());

describe('GeminiClient', () => {
  it('envía la imagen como inlineData y pide JSON a gemini-2.5-flash', async () => {
    const fn = mockFetch({ candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }] });
    const out = await new GeminiClient('KEY').json('sys', 'prompt', image);
    const req = lastRequest(fn);
    expect(out).toBe('{"items":[]}');
    expect(req.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(req.headers['x-goog-api-key']).toBe('KEY');
    expect(req.body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } });
    expect(req.body.generationConfig.responseMimeType).toBe('application/json');
    expect(req.body.systemInstruction.parts[0].text).toBe('sys');
  });

  it('separa el prompt de sistema y traduce assistant → model en el chat', async () => {
    const fn = mockFetch({ candidates: [{ content: { parts: [{ text: 'Hola' }] } }] });
    await new GeminiClient('KEY').chat([
      { role: 'system', content: 'contexto' },
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'qué tal' },
      { role: 'user', content: '¿qué ceno?' },
    ]);
    const { body } = lastRequest(fn);
    expect(body.systemInstruction.parts[0].text).toBe('contexto');
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('traduce errores HTTP a mensajes útiles', async () => {
    mockFetch({ error: { message: 'API key not valid' } }, 400);
    await expect(new GeminiClient('X').chat([{ role: 'user', content: 'a' }])).rejects.toThrow(/HTTP 400: API key not valid/);
    mockFetch({ error: { message: 'quota' } }, 429);
    await expect(new GeminiClient('X').chat([{ role: 'user', content: 'a' }])).rejects.toThrow(/Límite gratuito/);
  });

  it('respuesta vacía o bloqueada es un AIError', async () => {
    mockFetch({ promptFeedback: { blockReason: 'SAFETY' } });
    await expect(new GeminiClient('X').chat([{ role: 'user', content: 'a' }])).rejects.toBeInstanceOf(AIError);
  });
});

describe('OpenAICompatClient (Groq)', () => {
  it('usa el modelo de visión y data URL cuando hay imagen', async () => {
    const fn = mockFetch({ choices: [{ message: { content: '{}' } }] });
    await new OpenAICompatClient('Groq', 'https://api.groq.com/openai/v1', 'gsk', 'texto', 'vision').json('sys', 'p', image);
    const req = lastRequest(fn);
    expect(req.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(req.headers.Authorization).toBe('Bearer gsk');
    expect(req.body.model).toBe('vision');
    expect(req.body.response_format).toEqual({ type: 'json_object' });
    expect(req.body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,AAAA');
  });
});

describe('OllamaClient', () => {
  it('pide formato JSON y adjunta la imagen en images[]', async () => {
    const fn = mockFetch({ message: { content: '{}' } });
    await new OllamaClient('http://pc:11434/', 'llama3.2', 'llava').json('sys', 'p', image);
    const req = lastRequest(fn);
    expect(req.url).toBe('http://pc:11434/api/chat');
    expect(req.body).toMatchObject({ model: 'llava', format: 'json', stream: false });
    expect(req.body.messages[1].images).toEqual(['AAAA']);
  });
});

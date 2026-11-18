export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIImage {
  mimeType: string;
  base64: string;
}

/**
 * Contrato mínimo que cumple cada proveedor. La lógica de dominio (prompts, validación,
 * fallback local) vive fuera, así que añadir un proveedor nuevo es implementar dos métodos.
 */
export interface AIClient {
  readonly label: string;
  chat(messages: AIMessage[], signal?: AbortSignal): Promise<string>;
  /** Respuesta en modo JSON; `image` opcional para visión. Devuelve el texto crudo del modelo. */
  json(system: string, prompt: string, image?: AIImage, signal?: AbortSignal): Promise<string>;
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export async function postJson(url: string, body: unknown, headers: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new AIError('Sin conexión con el proveedor de IA (¿offline o CORS bloqueado?)');
  }
  if (!res.ok) {
    let detail = '';
    try {
      const err = (await res.json()) as { error?: { message?: string } | string };
      detail = typeof err.error === 'string' ? err.error : (err.error?.message ?? '');
    } catch {
      /* cuerpo no JSON */
    }
    const hint = res.status === 401 || res.status === 403 ? 'API key inválida o sin permisos' : res.status === 429 ? 'Límite gratuito alcanzado, espera un minuto' : `HTTP ${res.status}`;
    throw new AIError(detail ? `${hint}: ${detail}` : hint, res.status);
  }
  return res.json();
}

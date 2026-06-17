/**
 * Shared utilities: logger, SSE helpers, OpenAI-compatible streaming client.
 */

// ─── Logger ──────────────────────────────────────────────────────────────────
export function createLogger(tag: string) {
  const prefix = `[${tag}]`;
  return {
    log: (...args: any[]) => console.log(prefix, ...args),
    error: (...args: any[]) => console.error(prefix, ...args),
  };
}

// ─── CORS headers ────────────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, makers-conversation-id, Authorization',
};

// ─── SSE helpers ─────────────────────────────────────────────────────────────
export function sseEvent(data: Record<string, any>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function createSSEResponse(
  generator: (signal?: AbortSignal) => AsyncGenerator<string>,
  signal?: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator(signal)) {
          if (signal?.aborted) break;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          controller.enqueue(encoder.encode(sseEvent({ type: 'error_message', content: err?.message || 'Unknown error' })));
        }
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...CORS_HEADERS,
    },
  });
}

// Helper for OPTIONS preflight and JSON responses with CORS
export function corsResponse(body?: any, status = 200): Response {
  if (body === undefined) {
    // OPTIONS preflight
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── OpenAI-compatible streaming chat ────────────────────────────────────────
// Uses raw fetch to call /v1/chat/completions with stream:true.
// Works with EdgeOne AI Gateway and any OpenAI-compatible provider.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | any[];
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface StreamDelta {
  type: 'text' | 'tool_call' | 'done';
  text?: string;
  toolCall?: { index: number; id: string; name: string; arguments: string };
  finishReason?: string | null;
}

export async function* streamChat(
  baseURL: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools?: any[],
  signal?: AbortSignal,
): AsyncGenerator<StreamDelta> {
  const url = `${baseURL.replace(/\/+$/, '')}/chat/completions`;

  const body: any = {
    model,
    messages,
    stream: true,
    max_tokens: 8192,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${text.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') {
        yield { type: 'done' };
        return;
      }
      try {
        const chunk = JSON.parse(payload);
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta?.content) {
          yield { type: 'text', text: delta.content };
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            yield {
              type: 'tool_call',
              toolCall: {
                index: tc.index ?? 0,
                id: tc.id || '',
                name: tc.function?.name || '',
                arguments: tc.function?.arguments || '',
              },
            };
          }
        }
        if (choice.finish_reason) {
          yield { type: 'done', finishReason: choice.finish_reason };
        }
      } catch {}
    }
  }
}

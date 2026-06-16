/**
 * Chat endpoint — POST /chat
 *
 * Three-layer context acquisition:
 *   A. Page context — embed.js extracts current page content, injected into system prompt
 *   B. Site knowledge — if SITEMAP_URL is set, a search_knowledge tool is available
 *   C. Business API — if DATA_API_SCHEMA_URL is set, user-defined tools are available
 *
 * Uses OpenAI-compatible streaming API (works with EdgeOne AI Gateway).
 * When tools are available, runs a tool-calling loop (max 4 turns).
 */
import { resolveModelName } from '../_model';
import { createLogger, sseEvent, createSSEResponse, corsResponse, streamChat } from '../_shared';
import type { ChatMessage } from '../_shared';
import { loadApiSchema, callTool } from '../_api-proxy';
import type { ApiSchema } from '../_api-proxy';

const logger = createLogger('chat');

const MAX_HISTORY = 20;
const MAX_TOOL_TURNS = 4;

// In-process conversation history
const _history = new Map<string, ChatMessage[]>();

// ─── System prompt builder (Layer A: page context) ───────────────────────────
function buildSystemPrompt(
  env: Record<string, string | undefined>,
  pageContext?: { title?: string; url?: string; content?: string },
): string {
  let prompt = env.SYSTEM_PROMPT ||
    'You are a helpful, friendly AI assistant. Answer questions clearly and concisely. Use Markdown formatting when appropriate.';

  if (pageContext && (pageContext.title || pageContext.content)) {
    prompt += `\n\n---\n## Current Page Context\n`;
    if (pageContext.title) prompt += `**Title:** ${pageContext.title}\n`;
    if (pageContext.url) prompt += `**URL:** ${pageContext.url}\n`;
    if (pageContext.content) {
      prompt += `\n**Page Content:**\n${pageContext.content.slice(0, 6000)}\n`;
    }
    prompt += `\n---\nUse the page context above to answer questions about the current page. If the question is unrelated, still answer helpfully.\n`;
  }

  return prompt;
}

// ─── Convert API schema to OpenAI tool format ────────────────────────────────
function schemaToOpenAITools(schema: ApiSchema): any[] {
  return schema.tools.map((tool) => {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [name, param] of Object.entries(tool.parameters)) {
      properties[name] = {
        type: param.type || 'string',
        description: param.description || name,
        ...(param.enum ? { enum: param.enum } : {}),
      };
      if (param.required) required.push(name);
    }

    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      },
    };
  });
}

// ─── Knowledge search tool (Layer B, OpenAI format) ──────────────────────────
function getKnowledgeTool(): any {
  return {
    type: 'function',
    function: {
      name: 'search_site_knowledge',
      description: 'Search the indexed site knowledge base for articles matching a query.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results (default 5)' },
        },
        required: ['query'],
      },
    },
  };
}

async function handleKnowledgeSearch(input: Record<string, any>): Promise<any> {
  return {
    results: [],
    message: `No indexed content found for "${input.query}". Configure SITEMAP_URL to enable full-site indexing.`,
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────
export async function onRequest(context: any) {
  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return corsResponse();
  }

  const ctxEnv: Record<string, string | undefined> = context.env ?? process.env ?? {};
  const body = context.request.body ?? {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const pageContext: { title?: string; url?: string; content?: string } | undefined = body.pageContext;

  if (!message) {
    return corsResponse({ error: "'message' is required" }, 400);
  }

  const signal: AbortSignal | undefined = context.request.signal;
  // Support conversation_id from body (for cross-origin simple requests) or platform context
  const conversationId: string = body.conversation_id || context.conversation_id || '';
  const model = resolveModelName(ctxEnv);
  const baseURL = ctxEnv.AI_GATEWAY_BASE_URL || '';
  const apiKey = ctxEnv.AI_GATEWAY_API_KEY || '';
  const systemPrompt = buildSystemPrompt(ctxEnv, pageContext);

  // ─── Assemble available tools (Layers B + C) ─────────────────────────────
  const tools: any[] = [];
  let apiSchema: ApiSchema | null = null;

  if (ctxEnv.SITEMAP_URL) {
    tools.push(getKnowledgeTool());
  }

  // Load API schema from env var, remote URL, or local file
  logger.log(`[tools] attempting to load API schema...`);
  apiSchema = await loadApiSchema(ctxEnv);
  if (apiSchema) {
    tools.push(...schemaToOpenAITools(apiSchema));
    logger.log(`[tools] loaded ${apiSchema.tools.length} API tools`);
  } else {
    logger.log(`[tools] no API schema found (set DATA_API_SCHEMA, DATA_API_SCHEMA_URL, or place api-schema.json in project root)`);
  }

  // ─── Conversation history ────────────────────────────────────────────────
  if (!_history.has(conversationId)) {
    _history.set(conversationId, []);
  }
  const history = _history.get(conversationId)!;
  history.push({ role: 'user', content: message });
  while (history.length > MAX_HISTORY) history.shift();

  logger.log(`[request] cid=${conversationId}, model=${model}, tools=${tools.length}, msg="${message.slice(0, 80)}"`);

  // ─── SSE generator ───────────────────────────────────────────────────────
  async function* generate(sig?: AbortSignal): AsyncGenerator<string> {
    let lastPing = Date.now();

    try {
      let turns = 0;
      while (turns < (tools.length > 0 ? MAX_TOOL_TURNS : 1)) {
        if (sig?.aborted) break;
        turns++;

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history,
        ];

        let assistantText = '';
        let toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

        for await (const delta of streamChat(baseURL, apiKey, model, messages, tools.length > 0 ? tools : undefined, sig)) {
          // Ping
          if (Date.now() - lastPing > 5000) {
            yield sseEvent({ type: 'ping', ts: Date.now() });
            lastPing = Date.now();
          }

          if (delta.type === 'text' && delta.text) {
            assistantText += delta.text;
            yield sseEvent({ type: 'text_delta', delta: delta.text });
          }

          if (delta.type === 'tool_call' && delta.toolCall) {
            // Accumulate tool call arguments (may arrive in chunks)
            const tc = delta.toolCall;
            let existing = toolCalls.find((t) => t.id === tc.id);
            if (!existing && tc.id) {
              existing = { id: tc.id, name: tc.name, arguments: '' };
              toolCalls.push(existing);
            }
            if (existing) {
              if (tc.name) existing.name = tc.name;
              existing.arguments += tc.arguments;
            }
          }
        }

        // Save assistant message to history
        if (assistantText) {
          history.push({ role: 'assistant', content: assistantText });
          while (history.length > MAX_HISTORY) history.shift();
        } else if (toolCalls.length > 0) {
          history.push({
            role: 'assistant',
            content: '',
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            })),
          });
          while (history.length > MAX_HISTORY) history.shift();
        }

        // No tool calls → done
        if (toolCalls.length === 0) break;

        // ─── Execute tool calls ──────────────────────────────────────────
        for (const tc of toolCalls) {
          if (sig?.aborted) break;

          let input: Record<string, any> = {};
          try { input = JSON.parse(tc.arguments); } catch {}

          yield sseEvent({ type: 'tool_call', tool: tc.name, input });

          let result: any;
          if (tc.name === 'search_site_knowledge') {
            result = await handleKnowledgeSearch(input);
          } else if (apiSchema) {
            result = await callTool(apiSchema, ctxEnv.DATA_API_BASE_URL || '', ctxEnv.DATA_API_KEY, tc.name, input);
          } else {
            result = { error: `Unknown tool: ${tc.name}` };
          }

          yield sseEvent({ type: 'tool_result', tool: tc.name, result });

          history.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: tc.id,
          });
          while (history.length > MAX_HISTORY) history.shift();
        }

        toolCalls = [];
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || sig?.aborted) {
        // Client disconnected
      } else {
        logger.error('[stream] error:', err?.message || err);
        yield sseEvent({ type: 'error_message', content: err?.message || 'An error occurred' });
      }
    }

    yield 'data: [DONE]\n\n';
  }

  return createSSEResponse(generate, signal);
}

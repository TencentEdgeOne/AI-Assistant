/**
 * Chat endpoint — POST /chat
 *
 * Two-layer context acquisition:
 *   A. Page context — embed.js extracts current page content, injected into system prompt
 *   B. Business API — user-defined tools via api-schema.json
 *
 * Uses OpenAI-compatible streaming API (works with EdgeOne AI Gateway).
 * When tools are available, runs a tool-calling loop (max 4 turns).
 */
import { resolveModelName } from '../_model';
import { createLogger, sseEvent, createSSEResponse, corsResponse, streamChat } from '../_shared';
import type { ChatMessage } from '../_shared';
import { loadApiSchema, callTool } from '../_api-proxy';
import type { ApiSchema } from '../_api-proxy';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const logger = createLogger('chat');

const MAX_HISTORY = 20;
const MAX_TOOL_TURNS = 4;

// In-process conversation history
const _history = new Map<string, ChatMessage[]>();

// ─── Load config file ────────────────────────────────────────────────────────
interface AssistantConfig {
  name?: string;
  welcome?: string;
  systemPrompt?: string;
  suggestedQuestions?: string[];
}

let _configCache: AssistantConfig | null = null;
let _configLoaded = false;

async function loadConfig(): Promise<AssistantConfig> {
  if (_configLoaded) return _configCache || {};
  _configLoaded = true;
  try {
    const content = await readFile(resolve(process.cwd(), 'ai-chat-assistant.config.json'), 'utf-8');
    _configCache = JSON.parse(content);
    logger.log(`[config] loaded ai-chat-assistant.config.json`);
  } catch {
    _configCache = {};
  }
  return _configCache || {};
}

// ─── System prompt builder (Layer A: page context) ───────────────────────────
function buildSystemPrompt(
  config: AssistantConfig,
  env: Record<string, string | undefined>,
  pageContext?: { title?: string; url?: string; content?: string },
): string {
  let prompt = env.SYSTEM_PROMPT || config.systemPrompt ||
    'You are a helpful, friendly AI assistant. Answer questions clearly and concisely. Use Markdown formatting when appropriate.';

  prompt += '\n\nWhen using tools, always provide all required parameters. If a tool call fails due to missing parameters, do NOT retry with the same empty input — instead, try a different tool or answer based on available information.';

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

    // Enhance description with parameter info for models that struggle with schema
    let enhancedDesc = tool.description;
    const paramEntries = Object.entries(tool.parameters);
    if (paramEntries.length > 0) {
      const paramHints = paramEntries.map(([name, param]) => {
        const req = param.required ? ', REQUIRED' : '';
        return `${name} (${param.type || 'string'}${req}): ${param.description || name}`;
      });
      enhancedDesc += `\nParameters:\n- ${paramHints.join('\n- ')}`;
    }

    return {
      type: 'function',
      function: {
        name: tool.name,
        description: enhancedDesc,
        parameters: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      },
    };
  });
}

// ─── Main handler ────────────────────────────────────────────────────────────
export async function onRequest(context: any) {
  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return corsResponse();
  }

  const ctxEnv: Record<string, string | undefined> = context.env ?? process.env ?? {};
  const config = await loadConfig();
  const body = context.request.body ?? {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const pageContext: { title?: string; url?: string; content?: string } | undefined = body.pageContext;

  if (!message) {
    return corsResponse({ error: "'message' is required" }, 400);
  }

  const signal: AbortSignal | undefined = context.request.signal;
  const conversationId: string = body.conversation_id || context.conversation_id || '';
  const model = resolveModelName(ctxEnv);
  const baseURL = ctxEnv.AI_GATEWAY_BASE_URL || '';
  const apiKey = ctxEnv.AI_GATEWAY_API_KEY || '';

  // ─── Assemble available tools (Layer C) ──────────────────────────────────
  const tools: any[] = [];
  let apiSchema: ApiSchema | null = null;

  logger.log(`[tools] attempting to load API schema...`);
  apiSchema = await loadApiSchema(ctxEnv);
  if (apiSchema) {
    tools.push(...schemaToOpenAITools(apiSchema));
    logger.log(`[tools] loaded ${apiSchema.tools.length} API tools`);
  } else {
    logger.log(`[tools] no API schema found (set DATA_API_SCHEMA, DATA_API_SCHEMA_URL, or place api-schema.json in project root)`);
  }

  const systemPrompt = buildSystemPrompt(config, ctxEnv, pageContext);

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
            // Accumulate tool call arguments (may arrive in chunks, matched by index)
            const tc = delta.toolCall;
            let existing = toolCalls[tc.index];
            if (!existing) {
              existing = { id: tc.id || `tc_${tc.index}`, name: tc.name || '', arguments: '' };
              toolCalls[tc.index] = existing;
            }
            if (tc.id) existing.id = tc.id;
            if (tc.name) existing.name = tc.name;
            existing.arguments += tc.arguments;
          }
        }

        // Filter out any undefined slots from sparse array
        toolCalls = toolCalls.filter(Boolean);

        // Save assistant message to history
        if (assistantText || toolCalls.length > 0) {
          history.push({
            role: 'assistant',
            content: assistantText,
            ...(toolCalls.length > 0 ? {
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.arguments },
              })),
            } : {}),
          });
          while (history.length > MAX_HISTORY) history.shift();
        }

        // No tool calls → done
        if (toolCalls.length === 0) {
          // If AI produced no text but we have tool results, do one more round
          // without tools to force a text answer
          if (!assistantText && turns < MAX_TOOL_TURNS && history.some(h => h.role === 'tool')) {
            logger.log(`[stream] AI produced no text after tools, forcing one more round without tools`);
            tools.length = 0;
            continue;
          }
          break;
        }

        // ─── Execute tool calls ──────────────────────────────────────────
        let allFailed = true;
        for (const tc of toolCalls) {
          if (sig?.aborted) break;

          let input: Record<string, any> = {};
          try { input = JSON.parse(tc.arguments); } catch {}

          yield sseEvent({ type: 'tool_call', tool: tc.name, input });

          let result: any;
          if (apiSchema) {
            result = await callTool(apiSchema, ctxEnv.DATA_API_BASE_URL || '', ctxEnv.DATA_API_KEY, tc.name, input);
          } else {
            result = { error: `Unknown tool: ${tc.name}` };
          }

          if (!result.error) allFailed = false;

          yield sseEvent({ type: 'tool_result', tool: tc.name, result });

          history.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: tc.id,
          });
          while (history.length > MAX_HISTORY) history.shift();
        }

        // If any tool call failed, disable tools for next round
        // so AI must generate a text answer with available data
        if (!allFailed) {
          // Partial success — check if any had errors
          const recentResults = history.slice(-toolCalls.length);
          const hasAnyError = recentResults.some(h => {
            if (h.role !== 'tool') return false;
            try { return !!JSON.parse(h.content as string).error; } catch { return false; }
          });
          if (hasAnyError) {
            logger.log(`[stream] some tool calls failed, disabling tools for final answer`);
            tools.length = 0;
          }
        } else {
          logger.log(`[stream] all ${toolCalls.length} tool calls failed, disabling tools for final answer`);
          tools.length = 0;
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

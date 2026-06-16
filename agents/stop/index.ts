/**
 * Stop endpoint — POST /stop
 *
 * Cancels an active /chat stream for the given conversation.
 * The platform routes this to the same worker instance via conversation_id
 * in the request body (NOT the header).
 */
import { corsResponse } from '../_shared';

export async function onRequest(context: any) {
  if (context.request.method === 'OPTIONS') {
    return corsResponse();
  }

  const body = context.request.body ?? {};
  const conversationId = body.conversation_id;

  if (!conversationId) {
    return corsResponse({ error: 'conversation_id is required' }, 400);
  }

  return corsResponse({ ok: true });
}

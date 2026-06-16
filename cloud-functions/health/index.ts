export async function onRequest() {
  return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

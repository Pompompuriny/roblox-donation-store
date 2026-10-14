import { getCookie, sha256, sessionCookie, sameOrigin } from '../../_lib/security.js';
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const token = getCookie(request, 'donation_session');
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?')
    .bind(await sha256(token)).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie('', 0), 'Cache-Control': 'no-store' }
  });
}

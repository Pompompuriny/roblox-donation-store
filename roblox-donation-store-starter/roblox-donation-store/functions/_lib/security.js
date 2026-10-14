export function randomToken(byteCount = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return toBase64url(bytes);
}
export function toBase64url(bytes) {
  let s = '';
  for (const value of bytes) s += String.fromCharCode(value);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toBase64url(new Uint8Array(digest));
}
export function getCookie(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  for (const pair of cookies.split(';')) {
    const index = pair.indexOf('=');
    if (index > 0 && pair.slice(0, index).trim() === name) {
      return pair.slice(index + 1).trim();
    }
  }
  return null;
}
export function sessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return `donation_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}
export async function currentUser({ request, env }) {
  const token = getCookie(request, 'donation_session');
  if (!token) return null;
  const hash = await sha256(token);
  return env.DB.prepare(
    'SELECT user_id, username, picture FROM sessions WHERE token_hash = ? AND expires_at > ?'
  ).bind(hash, Date.now()).first();
}
export const unauthorized = () => Response.json({ error: 'Please link your Roblox account first.' }, { status: 401 });

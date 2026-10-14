import { getCookie, randomToken, sessionCookie, sha256 } from '../../_lib/security.js';

export async function onRequestGet({ request, env }) {
  const query = new URL(request.url).searchParams;
  const state = query.get('state');
  const code = query.get('code');
  const cookieState = getCookie(request, 'rbx_oauth_state');
  const fail = () => Response.redirect(`${env.SITE_URL}/?auth=error`, 302);
  if (!state || !code || !cookieState || state !== cookieState) return fail();
  const record = await env.DB.prepare('SELECT verifier,created_at FROM oauth_states WHERE state=?')
    .bind(state).first();
  if (!record || Date.now() - record.created_at > 600000) return fail();
  await env.DB.prepare('DELETE FROM oauth_states WHERE state=?').bind(state).run();
  try {
    const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.ROBLOX_CLIENT_ID,
        client_secret: env.ROBLOX_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        code_verifier: record.verifier,
        redirect_uri: `${env.SITE_URL.replace(/\/$/, '')}/api/auth/callback`
      })
    });
    if (!tokenResponse.ok) throw new Error(`Roblox token HTTP ${tokenResponse.status}`);
    const tokens = await tokenResponse.json();
    const profileResponse = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    if (!profileResponse.ok) throw new Error(`Roblox profile HTTP ${profileResponse.status}`);
    const profile = await profileResponse.json();
    if (!/^\d+$/.test(String(profile.sub)) || typeof profile.preferred_username !== 'string') {
      throw new Error('Missing Roblox user identity');
    }
    const session = randomToken(32);
    const hash = await sha256(session);
    await env.DB.prepare(`INSERT INTO sessions(token_hash,user_id,username,picture,expires_at)
      VALUES(?,?,?,?,?)`)
      .bind(hash, String(profile.sub), profile.preferred_username, profile.picture || null,
        Date.now() + 30 * 86400000).run();
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${env.SITE_URL}/#donate`,
        'Set-Cookie': sessionCookie(session),
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Roblox OAuth callback failed', error.message);
    return fail();
  }
}

import { randomToken, sha256 } from '../../_lib/security.js';

export async function onRequestGet({ env }) {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = await sha256(verifier);
  await env.DB.prepare('INSERT INTO oauth_states(state,verifier,created_at) VALUES(?,?,?)')
    .bind(state, verifier, Date.now()).run();
  const params = new URLSearchParams({
    client_id: env.ROBLOX_CLIENT_ID,
    redirect_uri: `${env.SITE_URL.replace(/\/$/, '')}/api/auth/callback`,
    scope: 'openid profile',
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state
  });
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `https://apis.roblox.com/oauth/v1/authorize?${params}`,
      'Set-Cookie': `rbx_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/callback; Max-Age=600`,
      'Cache-Control': 'no-store'
    }
  });
}

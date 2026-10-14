import { currentUser, sameOrigin, unauthorized } from '../_lib/security.js';
import { findPass, purchaseUrl } from '../_lib/passes.js';
import { ownsPass } from '../_lib/ownership.js';
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await currentUser(context);
  if (!user) return unauthorized();
  const payload = await request.json().catch(() => ({}));
  const pass = findPass(payload.passId);
  if (!pass) return Response.json({ error: 'Unknown gamepass.' }, { status: 400 });
  const old = await env.DB.prepare('SELECT status,created_at FROM donation_intents WHERE user_id=? AND pass_id=?')
    .bind(user.user_id, pass.id).first();
  if (old?.status === 'verified') return Response.json({ status: 'verified' });
  if (old?.status === 'already_owned') return Response.json({ status: 'already_owned' });
  if (old?.status === 'pending' && Date.now() - old.created_at < 7 * 86400000) {
    return Response.json({ status: 'pending', url: purchaseUrl(pass.id) });
  }
  try {
    const owned = await ownsPass(env, user.user_id, pass.id);
    if (owned) {
      await env.DB.prepare(`INSERT INTO donation_intents(user_id,pass_id,username,status,created_at)
        VALUES(?,?,?,?,?) ON CONFLICT(user_id,pass_id)
        DO UPDATE SET status='already_owned', username=excluded.username, created_at=excluded.created_at`)
        .bind(user.user_id, pass.id, user.username, 'already_owned', Date.now()).run();
      return Response.json({ status: 'already_owned' });
    }
    await env.DB.prepare(`INSERT INTO donation_intents(user_id,pass_id,username,status,created_at)
      VALUES(?,?,?,?,?) ON CONFLICT(user_id,pass_id)
      DO UPDATE SET status='pending', username=excluded.username,
        created_at=excluded.created_at, verified_at=NULL, notified_at=NULL,
        notify_state='none', last_check_at=NULL`)
      .bind(user.user_id, pass.id, user.username, 'pending', Date.now()).run();
    return Response.json({ status: 'pending', url: purchaseUrl(pass.id) });
  } catch (error) {
    console.error('Checkout precheck failed', error.message);
    return Response.json({ error: 'Roblox verification is temporarily unavailable. Please try later.' }, { status: 503 });
  }
}

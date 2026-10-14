import { currentUser, sameOrigin, unauthorized } from '../_lib/security.js';
import { findPass } from '../_lib/passes.js';
import { notifyIfNeeded, verifyIntent } from '../_lib/donations.js';
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await currentUser(context);
  if (!user) return unauthorized();
  const payload = await request.json().catch(() => ({}));
  const pass = findPass(payload.passId);
  if (!pass) return Response.json({ error: 'Unknown gamepass.' }, { status: 400 });
  const record = await env.DB.prepare(`SELECT * FROM donation_intents WHERE user_id=? AND pass_id=?`)
    .bind(user.user_id, pass.id).first();
  if (!record) return Response.json({ error: 'Choose Buy on the website before verifying.' }, { status: 409 });
  if (record.status === 'verified') {
    await notifyIfNeeded(env, user.user_id, pass.id);
    return Response.json({ status: 'verified' });
  }
  if (record.status !== 'pending') return Response.json({ status: record.status });
  if (record.last_check_at && Date.now() - record.last_check_at < 15000) {
    return Response.json({ status: 'pending', message: 'Try again shortly.' });
  }
  try {
    const status = await verifyIntent(env, record);
    return Response.json({ status });
  } catch (error) {
    console.error('Verify failed', error.message);
    return Response.json({ error: 'Roblox ownership lookup is temporarily unavailable.' }, { status: 503 });
  }
}

import { verifyIntent, notifyIfNeeded } from '../../_lib/donations.js';
export async function onRequestPost({ request, env }) {
  if (!env.SWEEP_SECRET || request.headers.get('Authorization') !== `Bearer ${env.SWEEP_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Expire stale checkout intents after seven days.
  await env.DB.prepare("UPDATE donation_intents SET status='expired' WHERE status='pending' AND created_at <= ?")
    .bind(Date.now() - 7 * 86400000).run();
  // Verify only pending attempts; do not automatically report old ownerships.
  const pending = await env.DB.prepare(`SELECT * FROM donation_intents
    WHERE status='pending' AND created_at > ? AND (last_check_at IS NULL OR last_check_at < ?)
    ORDER BY created_at ASC LIMIT 20`)
    .bind(Date.now() - 7 * 86400000, Date.now() - 60000).all();
  let checked = 0;
  let verified = 0;
  for (const record of pending.results) {
    try {
      const result = await verifyIntent(env, record);
      checked += 1;
      if (result === 'verified') verified += 1;
    } catch (error) {
      console.error('Sweep ownership check failed', record.pass_id, error.message);
    }
  }
  const queued = await env.DB.prepare(`SELECT user_id,pass_id FROM donation_intents
    WHERE status='verified' AND (notify_state='pending' OR (notify_state='sending' AND notify_attempt_at < ?))
    LIMIT 40`).bind(Date.now() - 120000).all();
  for (const record of queued.results) await notifyIfNeeded(env, record.user_id, record.pass_id);
  return Response.json({ checked, verified });
}

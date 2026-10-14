import { currentUser } from '../_lib/security.js';
export async function onRequestGet(context) {
  const user = await currentUser(context);
  if (!user) return Response.json({ user: null, passes: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const rows = await context.env.DB.prepare(`SELECT pass_id, status, verified_at, notified_at
    FROM donation_intents WHERE user_id=? ORDER BY created_at DESC`)
    .bind(user.user_id).all();
  return Response.json({ user, passes: rows.results }, { headers: { 'Cache-Control': 'no-store' } });
}

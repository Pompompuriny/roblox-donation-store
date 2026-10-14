import { findPass } from './passes.js';
import { ownsPass } from './ownership.js';

async function postDiscord(env, record) {
  const pass = findPass(record.pass_id);
  if (!pass) throw new Error('Unknown pass in database');
  const body = {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: 'Donation verified',
      description: `**${record.username}** now owns **${pass.name}**.`,
      color: 0x05c77a,
      fields: [
        { name: 'Gamepass', value: pass.name, inline: true },
        { name: 'Listed price', value: `${pass.price.toLocaleString('en-US')} Robux`, inline: true },
        { name: 'Roblox User ID', value: String(record.user_id), inline: true },
        { name: 'Verification', value: 'Owned in Roblox inventory', inline: false }
      ],
      footer: { text: `Gamepass ID ${pass.id} | Ownership does not establish exact purchase price/time` },
      timestamp: new Date().toISOString()
    }]
  };
  const response = await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Discord API failed: HTTP ${response.status}`);
}

export async function notifyIfNeeded(env, userId, passId) {
  const record = await env.DB.prepare(
    'SELECT * FROM donation_intents WHERE user_id=? AND pass_id=?'
  ).bind(userId, passId).first();
  if (!record || record.status !== 'verified' || record.notify_state === 'sent') return;
  const now = Date.now();
  // Claim only if not currently being sent; stale claims can be retried.
  const claim = await env.DB.prepare(`UPDATE donation_intents SET notify_state='sending', notify_attempt_at=?
    WHERE user_id=? AND pass_id=? AND status='verified'
      AND (notify_state='pending' OR (notify_state='sending' AND notify_attempt_at < ?))`)
    .bind(now, userId, passId, now - 120000).run();
  if (!claim.meta.changes) return;
  try {
    await postDiscord(env, record);
    await env.DB.prepare(`UPDATE donation_intents SET notify_state='sent', notified_at=?
      WHERE user_id=? AND pass_id=? AND notify_state='sending'`)
      .bind(Date.now(), userId, passId).run();
  } catch (error) {
    console.error('Discord delivery failure', error.message);
    await env.DB.prepare(`UPDATE donation_intents SET notify_state='pending'
      WHERE user_id=? AND pass_id=? AND notify_state='sending'`)
      .bind(userId, passId).run();
  }
}

export async function verifyIntent(env, record) {
  if (record.status !== 'pending') return record.status;
  const owned = await ownsPass(env, record.user_id, record.pass_id);
  const now = Date.now();
  if (owned) {
    await env.DB.prepare(`UPDATE donation_intents
      SET status='verified', verified_at=?, last_check_at=?, notify_state='pending'
      WHERE user_id=? AND pass_id=? AND status='pending'`)
      .bind(now, now, record.user_id, record.pass_id).run();
    await notifyIfNeeded(env, record.user_id, record.pass_id);
    return 'verified';
  }
  await env.DB.prepare(`UPDATE donation_intents SET last_check_at=?
    WHERE user_id=? AND pass_id=? AND status='pending'`)
    .bind(now, record.user_id, record.pass_id).run();
  return 'pending';
}

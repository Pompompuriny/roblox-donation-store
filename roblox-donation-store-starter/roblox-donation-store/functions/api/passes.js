import { PASSES } from '../_lib/passes.js';
export async function onRequestGet() {
  const passes = PASSES.map(p => ({ ...p, icon: null }));
  try {
    const ids = PASSES.map(p => p.id).join(',');
    const thumbnailUrl = `https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${ids}&size=150x150&format=Png&isCircular=false`;
    const res = await fetch(thumbnailUrl);
    if (res.ok) {
      const data = await res.json();
      const icons = new Map((data.data || []).map(item => [Number(item.targetId), item.imageUrl]));
      for (const pass of passes) pass.icon = icons.get(pass.id) || null;
    }
  } catch (err) {
    console.warn('Gamepass thumbnails unavailable', err.message);
  }
  return Response.json({ passes }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}

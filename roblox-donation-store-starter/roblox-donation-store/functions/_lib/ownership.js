// Uses Roblox Open Cloud inventory API. The response only counts on successful status 200.
export async function ownsPass(env, userId, passId) {
  const filter = encodeURIComponent(`gamePassIds=${passId}`);
  const url = `https://apis.roblox.com/cloud/v2/users/${encodeURIComponent(userId)}/inventory-items?filter=${filter}`;
  const response = await fetch(url, {
    headers: { 'x-api-key': env.ROBLOX_API_KEY, 'Accept': 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Roblox ownership lookup failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.inventoryItems)) {
    throw new Error('Roblox ownership lookup returned invalid data');
  }
  // We filtered by one exact pass ID; a matching returned item means ownership.
  return payload.inventoryItems.length > 0;
}

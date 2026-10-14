let user = null;
let owned = new Map();
let passes = [];
const grid = document.getElementById('passGrid');
const accountBody = document.getElementById('accountBody');
const feedback = document.getElementById('feedback');

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function setFeedback(message, error = false) {
  feedback.textContent = message;
  feedback.classList.toggle('error', error);
}
async function refreshAccount() {
  const data = await jsonRequest('/api/me');
  user = data.user;
  owned = new Map(data.passes.map(p => [Number(p.pass_id), p.status]));
  accountBody.replaceChildren();
  const title = document.createElement('h2');
  title.textContent = user ? `Linked as @${user.username}` : 'Link your Roblox account';
  accountBody.append(title);
  if (user) {
    const row = document.createElement('div'); row.className = 'account-row';
    if (user.picture) {
      const avatar = document.createElement('img');
      avatar.className = 'avatar'; avatar.alt = 'Roblox avatar'; avatar.src = user.picture;
      row.append(avatar);
    }
    const p = document.createElement('p'); p.textContent = `Roblox ID: ${user.user_id}`;
    row.append(p);
    const btn = document.createElement('button'); btn.className = 'logout';
    btn.textContent = 'Unlink / Log out';
    btn.addEventListener('click', async () => {
      try { await jsonRequest('/api/auth/logout', { method: 'POST' }); await refreshAccount(); renderPasses(); }
      catch (error) { setFeedback(error.message, true); }
    });
    accountBody.append(row, btn);
  } else {
    const p = document.createElement('p'); p.textContent = 'Sign in on Roblox, then return here to choose a pass.';
    const link = document.createElement('a'); link.className = 'primary';
    link.href = '/api/auth/start'; link.textContent = 'Link with Roblox';
    accountBody.append(p, link);
  }
}
function makeButton(text, cls, action) {
  const button = document.createElement('button');
  button.className = cls;
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await action(); } catch (error) { setFeedback(error.message, true); }
    finally { button.disabled = false; }
  });
  return button;
}
function renderPasses() {
  grid.replaceChildren();
  for (const pass of passes) {
    const card = document.createElement('article'); card.className = 'card pass';
    const logo = document.createElement('div'); logo.className = 'pass-icon';
    logo.textContent = pass.name.toLowerCase().includes('coins') ? '$' : '*';
    if (pass.icon) {
      const img = document.createElement('img'); img.src = pass.icon;
      img.alt = `${pass.name} gamepass icon`;
      img.addEventListener('error', () => img.remove());
      logo.append(img);
    }
    const info = document.createElement('div'); info.className = 'pass-info';
    const name = document.createElement('p'); name.className = 'pass-name'; name.textContent = pass.name;
    const price = document.createElement('span'); price.className = 'price';
    price.textContent = `R$ ${pass.price.toLocaleString('en-US')}`;
    const state = owned.get(pass.id);
    const stateText = document.createElement('span'); stateText.className = 'status';
    stateText.textContent = state === 'verified' ? 'Verified owner' :
      state === 'already_owned' ? 'Already owned before checkout' :
      state === 'pending' ? 'Awaiting purchase / verification' : 'Not purchased through this store yet';
    const actions = document.createElement('div'); actions.className = 'pass-actions';
    if (!user) {
      const link = document.createElement('a'); link.href = '/api/auth/start'; link.className = 'buy'; link.textContent = 'Link Roblox'; actions.append(link);
    } else if (state === 'verified' || state === 'already_owned') {
      const disabled = document.createElement('button'); disabled.className = 'buy'; disabled.disabled = true;
      disabled.textContent = state === 'verified' ? 'Verified' : 'Already owned'; actions.append(disabled);
    } else {
      actions.append(makeButton(state === 'pending' ? 'Open Roblox' : 'Buy on Roblox', 'buy', async () => {
        const response = await jsonRequest('/api/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passId: pass.id })
        });
        if (response.status === 'pending') window.location.assign(response.url);
        else { setFeedback('This gamepass is already owned by your Roblox account.'); await refreshAccount(); renderPasses(); }
      }));
      if (state === 'pending') actions.append(makeButton('Verify now', 'verify', async () => {
        const response = await jsonRequest('/api/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passId: pass.id })
        });
        setFeedback(response.status === 'verified' ? `${pass.name} verified! Discord will be notified.` :
          `${pass.name} is still pending. If you purchased it, try again shortly.`);
        await refreshAccount(); renderPasses();
      }));
    }
    info.append(name, price, stateText, actions); card.append(logo, info); grid.append(card);
  }
}
async function init() {
  try {
    const [catalog] = await Promise.all([jsonRequest('/api/passes'), refreshAccount()]);
    passes = catalog.passes;
    renderPasses();
    if (new URL(location.href).searchParams.get('auth') === 'error') {
      setFeedback('Roblox login failed. Please try again.', true);
    }
    setInterval(async () => {
      try { await refreshAccount(); renderPasses(); } catch { /* retry on next interval */ }
    }, 30000);
  } catch (error) { setFeedback(error.message, true); }
}
init();

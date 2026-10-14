# Roblox Gamepass Donation Store for Cloudflare Pages

This starter is a phone-friendly, dark-themed gamepass storefront with **23 supplied gamepass IDs**, official Roblox OAuth sign-in, Cloudflare Pages Functions, D1 donation history, Roblox Open Cloud inventory ownership checks, Discord bot notifications, and a separate 5-minute scheduled Worker. There are NO tickets, spins, prize pools, or payment collection on the website.

## What happens

1. Player clicks **Link with Roblox** and authenticates on Roblox.
2. Cloudflare Pages saves a secure login session.
3. On the gamepass card, player clicks **Buy on Roblox**.
4. The backend first checks ownership. If player already owns it, no new donation is recorded. If not, a `pending` intent is saved in D1, then browser opens the Roblox gamepass page.
5. After purchase, the player can come back and click **Verify now**. The scheduled Worker also checks pending purchases every 5 minutes even if the website is closed.
6. When Roblox reports that the user owns the pass, the record is set to `verified`, and the Discord bot posts **Donation verified**. The same pass/user combination is not announced again on ordinary checks.

**Limitations:** Roblox inventory does not supply the exact time of purchase or amount paid, only ownership. The listed prices were provided by the project owner and may differ from Roblox's final sale price. A gamepass is one-time only. Old gamepasses already owned at checkout are marked `already_owned` and NOT recorded as new donations. If a bot send succeeds but the confirmation update to D1 fails, a rare duplicate Discord message is possible. Automatic verification checks pending intents up to 7 days after checkout. Roblox OAuth requires developer ID verification to register and users must be 13+ to authorize; unreviewed OAuth apps are limited to 10 test users. All passes should belong to the experience being monetized; cross-game pass sales were disabled starting May 30, 2026.

## Requirements

- Roblox creator access to the passes and Creator Dashboard; confirm each supplied pass ID, price, and sale status.
- Roblox developer account ID-verified to register an OAuth 2.0 app.
- Cloudflare account.
- GitHub account to host this repo.
- Discord server and Discord Developer Portal access.
- Node.js on a desktop if deploying with Wrangler CLI. GitHub web upload can also be used for the website.

## 1. Put the files on GitHub

1. Create a new repository, e.g. `roblox-donation-store`.
2. Upload the **contents** of this folder to the repository root, preserving `public/`, `functions/`, `schema.sql`, and `cron-worker/`.
3. Never upload `.dev.vars`, real bot tokens, Roblox client secrets, or Roblox API keys.

## 2. Deploy Cloudflare Pages

1. Cloudflare dashboard > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Connect the new repository.
3. Project name: choose any, e.g. `my-roblox-donations`.
4. Framework: **None**. Build command: leave blank. Build output directory: **public**. Root directory: repo root.
5. Deploy. You will get `https://YOUR-PROJECT.pages.dev`.
6. Cloudflare Pages Functions are in the top-level `functions/` folder, not inside `public/`. Direct Upload through Cloudflare dashboard does NOT support Functions; use Git or Wrangler.

## 3. Set up Cloudflare D1

1. Cloudflare dashboard > **Storage & databases** > **D1** > **Create database**; call it `donation_db`.
2. Go to your **Pages project** > **Settings** > **Bindings** > **Add** > **D1 database** (dashboard wording may differ). Set binding variable name to exactly `DB`, select `donation_db`, and save.
3. Create tables in the D1 console by executing the contents of `schema.sql`, OR run this locally after installing Wrangler and logging in:

   ```sh
   npm install
   npx wrangler login
   npx wrangler d1 execute donation_db --remote --file=schema.sql
   ```

4. Redeploy the Pages project after attaching its D1 binding.

## 4. Register Roblox OAuth 2.0 app

1. Go to https://create.roblox.com/dashboard/credentials and find **OAuth 2.0 Apps**.
2. Register an app; choose **Account Linking Tools** if applicable, then minimum identity scopes **openid** and **profile**.
3. Redirect URI must match exactly: `https://YOUR-PROJECT.pages.dev/api/auth/callback`.
4. Website entry URI: `https://YOUR-PROJECT.pages.dev`.
5. Save the Roblox **Client ID** and **Client Secret**. The developer account must be ID-verified.
6. In private mode you can test with up to 10 unique Roblox users. Request Roblox review/publication to allow more users; provide the required privacy policy, terms, and demonstration details.
7. This project uses OAuth **authorization code + PKCE**. Users never enter a Roblox password on your site.

## 5. Create Roblox Open Cloud API key

1. In Roblox Creator Dashboard, open **Open Cloud API Keys**.
2. Create a narrowly-scoped key for read-only inventory access. Select the minimum inventory read access offered by the console, if required.
3. Save it as `ROBLOX_API_KEY` in Cloudflare Pages secrets.
4. The `ownsPass()` function calls `https://apis.roblox.com/cloud/v2/users/USER_ID/inventory-items?filter=gamePassIds=PASS_ID`, and only accepts a successful result from Roblox.
5. Check whether your API key's permissions, user privacy, and Roblox account are compatible with this endpoint before inviting users. Roblox errors are NOT interpreted as unowned or owned.

Official reference: https://create.roblox.com/docs/cloud/guides/inventory

## 6. Create Discord bot

1. Open https://discord.com/developers/applications > **New Application**.
2. Name it e.g. `donations`, upload an icon, then open **Bot** and copy/reset its Bot Token.
3. Under installation/OAuth2 settings, enable Guild install and generate the bot installation URL. Invite it to your server with permission **View Channel**, **Send Messages**, and **Embed Links** for the designated donations channel.
4. In Discord Settings > Advanced turn on Developer Mode. Right-click or long-press your target `#donations` channel, then Copy Channel ID.
5. Bot token goes in `DISCORD_BOT_TOKEN`; channel ID goes in `DISCORD_CHANNEL_ID`.
6. The Pages backend posts directly to Discord's REST API. There is no need to run a 24/7 computer or websocket bot to send donation embeds.

## 7. Configure Cloudflare Pages variables/secrets

Cloudflare Pages project > **Settings** > **Variables and Secrets** > add:

| Variable | Value |
| --- | --- |
| `SITE_URL` | `https://YOUR-PROJECT.pages.dev` |
| `ROBLOX_CLIENT_ID` | the OAuth app Client ID |
| `ROBLOX_CLIENT_SECRET` | the OAuth app Secret (**secret**) |
| `ROBLOX_API_KEY` | Roblox Open Cloud inventory key (**secret**) |
| `DISCORD_BOT_TOKEN` | Discord bot token (**secret**) |
| `DISCORD_CHANNEL_ID` | Discord channel ID |
| `SWEEP_SECRET` | long random text (**secret**; must equal Cron Worker's secret) |

Use `https`, no trailing slash. Define values in **production** environment; repeat in preview if needed. Redeploy after saving.

## 8. Set up automatic background verification

Because Cloudflare Pages Functions are request-driven, the separate scheduled Worker is what makes checks run even after players close the site. Its schedule is every 5 minutes.

1. Open `cron-worker/wrangler.jsonc` and replace `https://YOUR-PROJECT.pages.dev` with your Pages URL.
2. In the terminal, from the repo root:

   ```sh
   npm install
   cd cron-worker
   npx wrangler deploy
   npx wrangler secret put SWEEP_SECRET
   ```

3. Enter the exact same random secret used for the Pages `SWEEP_SECRET` variable.
4. Check Cloudflare Workers & Pages > `donation-verifier-cron` > settings > Triggers, that Cron Triggers shows `*/5 * * * *`.
5. The worker calls the protected Pages endpoint `/api/internal/sweep`. The backend verifies only unexpired `pending` attempts and retries unsent Discord notifications.

## 9. Test in this order

1. Open your Pages website in a normal browser.
2. Click **Link with Roblox**. You should be sent to an official `apis.roblox.com` sign-in page and returned as `@username`.
3. Use a pass that your test account does not own. Click **Buy on Roblox**. A pending record must be saved before redirecting.
4. Complete a real purchase in Roblox. Your browser may stay on Roblox; return to the website and click **Verify now** or allow the 5-minute sweep to run.
5. A successful check should show **Verified owner** and create a Discord embed.
6. Try clicking Verify again; it should not post another embed.
7. Test a gamepass you already own *before* pressing Buy; it should say **Already owned**, and not claim a new donation.
8. Temporarily prevent bot from posting, verify an item, restore bot permission, and confirm the scheduled sweep retries the message.
9. Check mobile layout, screenshots, missing thumbnails, and outdated pass prices.

## 10. Change the website or passes

- Display names/IDs/advertised prices: `functions/_lib/passes.js`.
- Dark theme and green logo: `public/style.css` and `public/index.html`.
- Store purchase and Verify logic: `public/app.js`, `functions/api/checkout.js`, and `functions/api/verify.js`.
- Discord embed: `functions/_lib/donations.js`.
- Roblox ownership check: `functions/_lib/ownership.js`.
- Schedule: `cron-worker/wrangler.jsonc`.
- Update the link behind the website Discord button (`id="discordLink"`) in `public/index.html`.

## Security and operational notes

- Do not collect or ask for Roblox passwords, Roblox `.ROBLOSECURITY` cookies, or Discord user tokens.
- Never trust a username or a `passId` supplied by the browser as proof of identity or purchase. This code gets the Roblox ID from a server-side, HttpOnly session cookie and whitelists all pass IDs.
- Keep OAuth `state` and PKCE enabled. Do not expose secrets to HTML/JS.
- Treat any 401, 403, 429 or 500 from Roblox as an API error, not a negative ownership result.
- Use Cloudflare rate limiting and bot monitoring before deploying widely. The included basic database cooldown is not a complete anti-abuse solution.
- Avoid making false claims that any Discord log is a verified payment transaction, precise sale amount, or instant Roblox receipt; the log verifies ownership after a new on-site checkout attempt.
- The starter has been syntax-checked locally but requires your own real Roblox/Cloudflare/Discord credentials and live integration testing before production use.

## References

- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/get-started/
- Cloudflare D1 bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Roblox OAuth registration: https://create.roblox.com/docs/cloud/auth/oauth2-registration
- Roblox OAuth implementation: https://create.roblox.com/docs/cloud/auth/oauth2-develop
- Roblox Inventory API: https://create.roblox.com/docs/cloud/guides/inventory
- Roblox gamepasses: https://create.roblox.com/docs/production/monetization/passes
- Discord bot apps: https://discord.com/developers/applications

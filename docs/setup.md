# Set up Content Desk on Windows

For your first session, install Git and Node.js, create **one hosted PostgreSQL database**, and sign in to Content Desk. That unlocks Script Studio, Metadata Kit, the calendar, and the competitor tracker. You can add each platform when you want its data.

| What you want to use | Account or credential to prepare |
| --- | --- |
| Write and plan locally | Neon **or** Supabase. The installer generates your Content Desk owner password. |
| Clone the source | The repository is public. You can clone it in Git Bash. Use your existing GitHub account for managing the repository and connecting Vercel later. |
| Research public YouTube videos | Google Cloud project with a YouTube Data API key |
| See private YouTube analytics or edit your video metadata | Google OAuth web client and access to the Google account that owns the channel |
| Include Reddit in research | Reddit account with approved Data API access for this use case |
| See your own Instagram Reel insights | Instagram professional account, linked Facebook Page, and Meta developer app |
| Import X analytics | A post-level CSV export from your X account |
| Open Content Desk from another device | Vercel account connected to the GitHub repository |

## 1. Install Git Bash and Node.js

1. On your Windows x64 laptop, install **Git for Windows** if you do not already have Git Bash. [Git for Windows download](https://git-scm.com/install/windows)
2. Install the **LTS Windows x64 installer** for Node.js, including npm. Use Node 22 or newer for a fresh installation. [Node.js download](https://nodejs.org/en/download)
3. Open a new **Git Bash** window from the Start menu. Run the following commands. Each should print a version.

```bash
git --version
node --version
npm --version
```

## 2. Download Content Desk

For a first install, run the following commands in Git Bash. The application lives on `feature/content-desk`.

```bash
git clone --branch feature/content-desk --single-branch https://github.com/devwork028-arch/content-dashboard.git
cd content-dashboard
npm ci
npm run setup
```

If you already cloned the repository, open Git Bash in that folder, run `git fetch origin feature/content-desk`, `git switch feature/content-desk`, and `git pull --ff-only origin feature/content-desk`, then run `npm ci`. Run `npm run setup` only for a new configuration.

**Save the dashboard password printed by setup.** Setup also creates `.env.local` in the project folder and generates the session secret, cron secret, and token-encryption key. Keep that file on your machine. Paste credentials into the file with an editor, and keep them out of chat, screenshots, and Git commits.

## 3. Create a database and set DATABASE_URL

**Option A — Neon**

1. Sign up or sign in, create a project named `content-desk`, and choose an available region close to you. [Neon Console](https://console.neon.tech/)
2. Open the project dashboard and select **Connect**. Choose your database and role, enable connection pooling, and copy the PostgreSQL connection string with its TLS parameters. [Neon connection guide](https://neon.com/docs/connect/connect-from-any-app)

**Option B — Supabase**

1. Sign up or sign in, choose or create an organization, then create a project named `content-desk`. Save the **database password** you choose and wait for the project to finish provisioning. [Supabase Dashboard](https://supabase.com/dashboard)
2. Open **Connect**, choose **Session pooler** for the laptop, and copy its connection string. Replace the password placeholder with the database password. Percent-encode reserved characters in that password, such as `@` as `%40`. Keep the pooler host, port, username, and TLS settings from the dashboard. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)

From Git Bash in the repository folder, run `notepad.exe .env.local`. Paste the complete connection string after the existing `DATABASE_URL=` and save. Keep `APP_URL=http://localhost:3000` for the first run. The password inside the database URL is for PostgreSQL. The password printed in step 2 is for the Content Desk sign-in page.

## 4. Start the app and check your first save

```bash
npm run local
```

This applies database migrations, seeds a sample script and calendar entry, and starts the server. Leave Git Bash open. Open [Content Desk on your laptop](http://localhost:3000), sign in with the generated dashboard password, and select **Script Studio**. Type a line into the sample, wait for **Saved**, and refresh the page. Your line and its revision should be there.

Press **Ctrl+C** in Git Bash to stop the server. Next time, open Git Bash in the same folder and run `npm run dev`. After changing credentials in `.env.local`, restart the server before testing the corresponding integration.

## 5. Connect the platforms you use

### YouTube research, analytics, and metadata edits

1. Sign in to Google Cloud, create a project named **Content Desk**, and select it. Under **APIs & Services → Library**, enable **YouTube Data API v3**. Enable **YouTube Analytics API** if you want your channel metrics. [Google Cloud Console](https://console.cloud.google.com/)
2. For public research, open **APIs & Services → Credentials → Create credentials → API key**. Restrict the key to **YouTube Data API v3**, then set `YOUTUBE_API_KEY` in `.env.local`. For research alone, restart the app and use **Research → Refresh now**.
3. For owner analytics, open **Google Auth Platform**. Set the app name and contact email under **Branding**. For a personal Google account, choose **External** under **Audience**. While testing, add the channel owner's Google email as a test user. Under **Data Access**, configure the YouTube scopes you plan to request. The app asks for `youtube.readonly` and `yt-analytics.readonly` for insights, and adds `youtube.force-ssl` when you authorize metadata edits. For ongoing sync, use **In production** and complete any applicable Google verification. External apps in Testing normally receive seven-day refresh tokens for these scopes. [Google OAuth setup and token lifetime](https://developers.google.com/identity/protocols/oauth2)
4. Under **Clients**, create an OAuth client of type **Web application**. Add the exact local callback below to **Authorized redirect URIs**. Add the second URI after you know your production domain, replacing the example hostname. [Google web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server)

   ```text
   http://localhost:3000/api/google/callback
   https://YOUR-VERCEL-DOMAIN/api/google/callback
   ```

5. Copy the client ID to `GOOGLE_CLIENT_ID` and the client secret to `GOOGLE_CLIENT_SECRET`. Switch to your majdoorGamerz channel on YouTube and copy its **Channel ID** (starts with `UC`) into `YOUTUBE_CHANNEL_ID`. [YouTube advanced account settings](https://www.youtube.com/account_advanced)
6. Restart Content Desk. Use **Settings → Connect read-only**, select the owner channel, then **Analytics → Sync insights**. Check the channel ID in Settings and the last-sync time in Analytics. When you're ready to edit existing videos, use **Settings → Authorize metadata edits**. In **Metadata Kit**, preview a change to one of your videos and review the diff before confirming.

### Reddit research

1. Sign in to your Reddit account. Follow Reddit's Data API access process and describe the actual use case, including creator or commercial use where applicable. Wait for approval before enabling this source. [Reddit access policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) · [Reddit Data API guidance](https://support.reddithelp.com/hc/en-us/articles/14945211791892)
2. Register the approved confidential OAuth application using Reddit's instructions. Set `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` to the app credentials. Set `REDDIT_USER_AGENT` to a descriptive identifier such as `web:content-desk:1.0 (by /u/YOUR_USERNAME)`, replacing the username.
3. Restart the server, open **Research**, select **Refresh now**, and check the source names and refresh status. You can use the other sources while Reddit reviews the application.

### Instagram Reel insights

1. Use an Instagram **Business** or **Creator** account and link it to a Facebook Page you manage. Register with Meta for Developers, then create an app in **My Apps** and configure **Instagram API with Facebook Login**. Select the same Page during authorization. [Meta developer apps](https://developers.facebook.com/apps/) · [Instagram Platform documentation](https://developers.facebook.com/docs/instagram-platform/)
2. In Meta's **Graph API Explorer**, select your app and generate a user access token with the applicable permissions for discovering your Page and reading insights, including `pages_show_list`, `pages_read_engagement`, `instagram_basic`, and `instagram_manage_insights`. Follow any role or review requirements shown for the app. [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
3. In the Explorer, request `GET /me/accounts?fields=id,name,access_token,instagram_business_account`. Find the row for your linked Page. Set `META_PAGE_ID` to that row's **Page ID**, `META_PAGE_TOKEN` to that row's **Page access token**, and `META_GRAPH_VERSION` to the supported API version selected in the Explorer, including the leading `v`. Protect the response because it contains credentials. [Meta Page token guide](https://developers.facebook.com/docs/pages-api/getting-started/)
4. Restart Content Desk, select **Settings → Connect Instagram**, then **Analytics → Sync own Reels**. If the token expires, obtain a replacement, update the server configuration, restart, and reconnect.

### X CSV import

Export post-level analytics from your X account and select the CSV under **Analytics → X analytics → Import CSV**. For an installation check, you can save the following two lines as `sample-x.csv` and import it. The sample should display 120 impressions for the post. X integration uses files and requires no API credentials.

```csv
post,date,impressions,likes,replies,retweets
Sample gaming clip,2026-11-22,120,8,2,1
```

## 6. Deploy to Vercel when ready

1. Sign up with GitHub or connect your existing GitHub account to Vercel. Import `devwork028-arch/content-dashboard` as a **Next.js** project using the repository root. Give the Vercel GitHub integration access to this repository. [Vercel new project](https://vercel.com/new)
2. Select `feature/content-desk` as the production branch while the app lives there. If the first import picked `main`, update the production branch under the project's production environment settings and deploy the feature branch. [Vercel environments](https://vercel.com/docs/deployments/environments)
3. In the project's **Production** environment variables, set `DATABASE_URL`, `OWNER_PASSWORD_HASH`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `CRON_SECRET`. Set `APP_URL` to your exact production HTTPS origin without a trailing slash. Add credentials for the integrations you enabled. When sharing an existing database, retain its token-encryption key so the deployed app can read the saved connections.
4. Apply `npm run db:migrate` against the database selected for production. If you already migrated that same database locally, the migration is already applied. Deploy or redeploy after setting environment variables. Add the production YouTube redirect URI to the Google OAuth client, then open the production URL and sign in.
5. In Vercel's cron configuration, verify both routes from the committed `vercel.json`. Research is scheduled daily at **07:45 IST** and YouTube insights at **08:45 IST**. Vercel sends the configured cron secret in the authorization header. Check the invocation logs and sync timestamps after a scheduled run. [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

## If setup stops

| Symptom | What to check |
| --- | --- |
| Git Bash says `node` or `npm` is missing | Finish the Node.js installer, close Git Bash, open a new window, and run the version checks again. |
| npm cannot find `package.json` | Run `pwd` and `git branch --show-current`. Open the `content-dashboard` folder and switch to `feature/content-desk`. |
| Setup says `.env.local` already exists | Keep the file and the password you saved earlier. Edit the existing configuration and continue with `npm run local`. |
| Migration fails or login says setup is unavailable | Confirm the database project is active, the full URI is saved in `.env.local`, and the migration succeeds. On an IPv4-only network, use Supabase's session pooler. |
| Google reports `redirect_uri_mismatch` | Compare the full callback in Google Cloud against `APP_URL` plus `/api/google/callback`. Check scheme, hostname, port, and trailing slash. |
| The wrong YouTube channel is selected | Check `YOUTUBE_CHANNEL_ID` against the owner's advanced YouTube settings, restart, and reconnect with that channel. |

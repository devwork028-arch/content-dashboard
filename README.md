# Content Desk

Private English/Hinglish gaming-comedy workspace. This build includes owner login, Script Studio with revision history, per-script metadata, an IST calendar, competitor observations, public research adapters, research preferences and the planning dashboard. Write the dialogue yourself. Calendar entries track production and do not publish posts.

## First local run on Windows
Use Git Bash with Node 22 or newer, or the latest Node 20.x patch. Clone the application branch and generate your local configuration:

```bash
git clone --branch feature/content-desk --single-branch https://github.com/devwork028-arch/content-dashboard.git
cd content-dashboard
npm ci
npm run setup
```

Save the owner password printed by setup. Open `.env.local` in your editor and fill in `DATABASE_URL` with the connection string for your Neon or Supabase Content Desk database, including the provider's TLS settings. The file already contains the login secrets and placeholders for optional integrations. Setup preserves an existing file.

```bash
npm run local
```

This applies pending migrations, inserts sample records, and starts the development server. Open http://localhost:3000 and sign in with the generated password. For later sessions use `npm run dev`. Run `npm run local` again to apply pending migrations and restore missing samples. Existing sample edits are preserved.

### First laptop check

Open the sample in Script Studio, type a line, wait for **Saved**, then refresh and verify the line and version history. Copy a title from Metadata Kit and move a sample calendar post to another day. Sign out and open a protected page to verify it asks you to sign in. After adding provider credentials, test a read-only sync first. Use a video you own to preview a metadata diff before deciding whether to apply it.

## Writing workflow
Create a script, choose trio or solo, and wait for **Saved** before leaving the editor. Changes appear in version history. Restore a version to create a new revision. Select the same script in Metadata Kit, fill in the platform fields, save and copy them when ready. Move calendar items by dragging or editing their IST time. Export the competitor table to get its import headers.

## Optional research sources
Use .env.example for research variables. Restrict a Google Cloud API key to YouTube Data API v3 for public research. Configure approved Reddit app credentials and a descriptive user agent to enable Reddit. Publisher feed URLs must point to supported public RSS or Atom feeds. Partial source failures leave cached results available. Cron runs daily at 07:45 IST and requires Authorization: Bearer CRON_SECRET. Keep all secrets server-side.

## Checks and deployment
Run npm test, npm run check and npm run build. For Vercel, import the repository, select Next.js, use the repository root as the project root and select `feature/content-desk` as the production branch while the application lives there. Then set APP_URL to the HTTPS production origin and add the same database and application secrets. Apply migrations before serving traffic. Deploy vercel.json with the project and configure CRON_SECRET for Vercel Cron.

## YouTube owner setup

In Google Cloud Console create a project, enable YouTube Data API v3 and YouTube Analytics API, and configure the Google Auth Platform branding, audience and scopes. Create a Web application OAuth client. Register both exact redirect URIs:

    http://localhost:3000/api/google/callback
    https://YOUR-VERCEL-DOMAIN/api/google/callback

Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and YOUTUBE_CHANNEL_ID (the UC identifier in the owner channel’s advanced settings). Set APP_URL without a trailing slash. TOKEN_ENCRYPTION_KEY must be 32 random bytes encoded as base64. The setup script generates it. Keep the same key across deployments. For external consent use In production for persistent access. Testing mode normally expires refresh tokens after seven days with these scopes. Complete any Google verification applicable to the app.

Connect read-only in Settings for analytics. Select Authorize metadata edits only when needed. The additional scope is youtube.force-ssl. Confirm each diff in Metadata Kit, including thumbnail or playlist changes. Reverts require a new preview and confirmation. YouTube only supports scheduling eligible private, previously unpublished videos. Thumbnail restoration uses the previous YouTube-served image, which can differ from the original upload after compression.

Daily insights sync runs at 08:45 IST. It caches 7/28/90-day reports and each video's retention curve. Sync length depends on channel size and the configured Vercel function duration. Empty retention curves are normal for videos with little data. Channel reporting days follow YouTube's reporting timezone. Publishing slots and calendar times use IST. Quota estimates count this application's requests only. Exhausted daily quotas stop calls until reset; temporary limits use bounded backoff.

## Reddit and feeds

Request authorized Reddit Data API access for the use case, register the app, and set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET and a descriptive REDDIT_USER_AGENT. The public subreddit adapter uses application-only OAuth. Set TEKKEN_RSS_URL and ROCKSTAR_RSS_URL only to available official publisher feeds. Google Trends is optional and omitted. Missing credentials leave other research sources usable.

## Optional Instagram and X

Use Meta for Developers to create an app with Instagram API with Facebook Login. Link your Instagram professional account to your Facebook Page. Obtain the permissions for Page discovery and reading insights (pages_show_list, pages_read_engagement, instagram_basic and instagram_manage_insights as applicable), then obtain a Page access token for that Page. Set META_PAGE_ID, META_PAGE_TOKEN and META_GRAPH_VERSION to the version supported by your Meta app. Connect in Settings and select Sync own Reels in Analytics. The newer views metric supplies Reel play counts. Rotate expired tokens on the server and reconnect. Disconnect removes the local connection. Meta permissions can also be revoked in your account.

X accepts post-level CSV exports with date/time, post/tweet text or ID, impressions, likes, replies and reposts/retweets. The dashboard groups post metrics by the post week. Publishing stays manual.

## Provider documentation

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/youtube/analytics/channel_reports
- https://developers.google.com/youtube/v3/docs/videos/update
- https://developers.facebook.com/docs/instagram-platform/
- https://support.reddithelp.com/hc/en-us/articles/14945211791892
- https://vercel.com/docs/cron-jobs

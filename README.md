# Ontario PS5 Pro Uber Eats Monitor

A cloud-only GitHub Actions monitor that rotates through every known open Ontario Walmart location on Uber Eats for an orderable **PS5 Pro console**. It runs every five minutes, checks a throttled batch of 18 stores, filters out accessories and other PS5 models, and emails `adamleaf31@gmail.com` only after the same result appears in a second fresh browser session.

## Deploy for free

1. Create a **public** GitHub repository and upload this folder. Public repositories receive free standard GitHub-hosted Actions usage.
2. In Google Account → Security, enable 2-Step Verification and create an App Password for Mail.
3. In the repository, open Settings → Secrets and variables → Actions and add:
   - `GMAIL_USER`: `adamleaf31@gmail.com`
   - `GMAIL_APP_PASSWORD`: the 16-character Google App Password
   - `PROXY_SERVER`, `PROXY_USERNAME`, and `PROXY_PASSWORD`: the Webshare gateway credentials
4. Open Actions → Ontario PS5 Pro Uber Eats Monitor → Run workflow for the first check.

The scheduled interval is five minutes, GitHub Actions' minimum. A cached cursor covers all 148 stores in roughly nine scheduled runs, while per-store failure history and exponential backoff prevent repeated hammering. The workflow uses a full Chromium browser inside a virtual display because Uber Eats rejects direct API requests and may challenge headless browsers. Scheduled jobs can start late and Uber Eats can still challenge automation; the monitor never treats a failed or unconfirmed check as stock and emails a health warning if at least 20% of attempted checks fail.

## Local verification

```bash
npm ci
npx playwright install chromium
npm test
MAX_STORES=1 DRY_RUN=true HEADED=true npm start
```

The live store source is refreshed every run and validated; a bundled snapshot is used if the source is temporarily unavailable. No passwords are stored in the code.

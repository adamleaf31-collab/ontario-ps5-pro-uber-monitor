# Ontario PS5 Pro Uber Eats Monitor

A cloud-only GitHub Actions monitor that checks every known open Ontario Walmart location on Uber Eats for an orderable **PS5 Pro console**. It runs every five minutes, filters out accessories and other PS5 models, retries transient failures, suppresses duplicate alerts, and emails `adamleaf31@gmail.com`.

## Deploy for free

1. Create a **public** GitHub repository and upload this folder. Public repositories receive free standard GitHub-hosted Actions usage.
2. In Google Account → Security, enable 2-Step Verification and create an App Password for Mail.
3. In the repository, open Settings → Secrets and variables → Actions and add:
   - `GMAIL_USER`: `adamleaf31@gmail.com`
   - `GMAIL_APP_PASSWORD`: the 16-character Google App Password
4. Open Actions → Ontario PS5 Pro Uber Eats Monitor → Run workflow for the first check.

The scheduled interval is five minutes, GitHub Actions' minimum. The workflow uses a full Chromium browser inside a virtual display because Uber Eats rejects direct API requests and may challenge headless browsers. Scheduled jobs can occasionally start late, and Uber Eats can still change or challenge automation; the monitor retries, never treats a failed check as stock, and emails a health warning if at least 20% of stores fail.

## Local verification

```bash
npm ci
npx playwright install chromium
npm test
MAX_STORES=1 DRY_RUN=true HEADED=true npm start
```

The live store source is refreshed every run and validated; a bundled snapshot is used if the source is temporarily unavailable. No passwords are stored in the code.

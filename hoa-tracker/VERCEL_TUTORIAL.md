# Vercel for Infrastructure People

*Or: You already know half of this — it's just nginx with extra steps.*

---

## What Vercel Actually Is

You know how nginx works: it listens on 443, terminates TLS, proxies requests to an upstream, and serves static files. You configure it in a text file and restart the service.

Vercel is that, plus a build server, plus a CDN, managed by someone else.

More specifically, Vercel is three things stacked together:

1. **A build server** — like a CI runner that watches your GitHub repo. When you push, it clones the repo, runs `npm run build`, and produces static files + serverless functions.

2. **A CDN/edge network** — your built static assets get pushed to edge nodes worldwide. When someone hits your URL, the nearest edge node serves them. This is like having nginx serving from `/var/www` but the `/var/www` is replicated to 30 data centers.

3. **A managed reverse proxy** — like nginx in front of your app, but you don't configure it. It handles TLS termination, HTTP/2, custom domains, redirects, and routing. You don't touch a config file. You don't restart anything.

**What it is NOT:** a VPS. There's no SSH, no `/etc`, no systemd, no cron, no shell. You cannot log into it. You don't manage the OS. If you need a server to run things on, that's not Vercel — that's still your own box (oregano, tarragon, etc.).

---

## How It Works: GitHub Push → Live Site

Here's the full lifecycle of a deployment:

```
You push to GitHub
        │
        ▼
GitHub sends a webhook to Vercel
        │
        ▼
Vercel spins up a build container
        │
        ▼
Vercel clones your repo, reads package.json
        │
        ▼
Detects "next" in dependencies → "Ah, this is Next.js"
        │
        ▼
Runs `npm install` → `npm run build`
        │
        ▼
Next.js produces:
  - Static HTML/CSS/JS  →  pushed to CDN edge nodes
  - Serverless functions →  deployed to Vercel's function runtime
        │
        ▼
Vercel assigns a URL: hoa-tracker-dashboard.vercel.app
        │
        ▼
Live. HTTPS. Done.
```

The whole thing takes 1-3 minutes. You don't configure anything — Vercel auto-detects Next.js from `package.json` and knows what to do.

**Every push gets its own URL.** Push to `main` → updates the production URL. Push to a branch → gets a preview URL like `hoa-tracker-dashboard-git-feature-branch.vercel.app`. This is like having a staging environment per branch, for free.

---

## Custom Domains: How They Work

Right now your app lives at `hoa-tracker-dashboard.vercel.app`. You want `tracker.villasboulders.org`.

This is the part you already know — it's just DNS + a reverse proxy validation:

1. **You tell Vercel the domain:** In the Vercel dashboard, go to Project Settings → Domains → Add `tracker.villasboulders.org`.

2. **Vercel tells you what CNAME to add:** It shows you something like:
   ```
   CNAME  tracker  cname.vercel-dns.com
   ```
   (It might give you a specific verification value first, or it might just tell you to use `cname.vercel-dns.com`.)

3. **You add the CNAME in your DNS provider:** For villasboulders.org, that's Namecheap (your account: `deebuck`). Go to Namecheap → Domain List → Manage → Advanced DNS → Add New Record:
   - Type: CNAME Record
   - Host: `tracker`
   - Value: `cname.vercel-dns.com`
   - TTL: Automatic (or 300s)

4. **Vercel validates and provisions TLS:** Once the CNAME resolves, Vercel sees traffic coming to them for `tracker.villasboulders.org`. They auto-provision a Let's Encrypt certificate and terminate TLS at their edge. You don't run certbot. You don't manage renewal. It just works.

5. **Done.** `https://tracker.villasboulders.org` serves your app.

This is exactly what you'd do with nginx + certbot, except you don't SSH into anything, don't edit any server blocks, and don't set up a renewal cron.

**Important:** You only add the CNAME. Don't add an A record. Don't add the record at the root (apex) — use a subdomain (`tracker`). CNAMEs on apex domains can cause issues with some DNS providers (Namecheap included), though Vercel does support apex domains via ANAME/CNAME flattening if needed.

---

## The Free Tier: What You Get

Vercel's Hobby (free) tier for personal projects:

| Resource | Free Tier |
|----------|-----------|
| **Bandwidth** | 100 GB/month |
| **Build executions** | 6,000 minutes/month |
| **Deployments** | Unlimited |
| **Custom domains** | Unlimited (on free tier for personal accounts) |
| **Serverless function executions** | 100 GB-hours/month |
| **Concurrent builds** | 1 (builds queue if you push fast) |
| **Team members** | Not on free tier (personal only) |

For an HOA dashboard with 124 properties, a few board members checking it occasionally, and no heavy traffic — the free tier is more than enough. You'd have to hit 100 GB of transfer to hit limits, and that's a lot of page views.

**Note on organization accounts:** The spec mentions the GitHub org `vab-hoa`. Vercel free tier is for personal use. If you create a Vercel team for `vab-hoa`, teams have their own pricing. For a single-deployer situation, you can just use your personal Vercel account and import the org repo. If you need to share the Vercel dashboard with other board members later, you'd upgrade to a Pro team ($20/mo). For now, personal is fine — you're the only one deploying.

---

## Ignored Build Step: Don't Rebuild on Every Push

The `hoa-code` repo is a monorepo. It has the email processor, schemas, analysis docs, and the dashboard. You don't want every push to trigger a Vercel rebuild — only pushes that touch the dashboard directory.

Vercel has a feature for this called **Ignored Build Step**. You set it in Project Settings → Git → Ignored Build Step.

You provide a shell command. If the command exits with code 0, Vercel **skips** the build. If it exits non-zero, Vercel builds.

### Option A: Only build when dashboard files change

```bash
git diff --quiet HEAD^ HEAD -- hoa-tracker-dashboard/
```

This checks if any files in `hoa-tracker-dashboard/` changed in the latest push. If nothing changed there, exit 0 → skip build. If something changed, exit 1 → build.

### Option B: Only build on main branch pushes

Vercel already only deploys production on `main` branch pushes. Branch pushes get preview deployments. If you want to skip even preview builds for non-dashboard changes, use Option A.

### How to set it

In Vercel dashboard:
1. Go to your project → Settings → Git
2. Find "Ignored Build Step"
3. Toggle it on
4. Paste: `git diff --quiet HEAD^ HEAD -- hoa-tracker-dashboard/`
5. Save

Now when you push a change to `email_processor.py` or `schema.sql`, Vercel sees the push, runs the diff command, sees nothing in `hoa-tracker-dashboard/` changed, and skips the build. No wasted build minutes.

---

## Root Directory: Telling Vercel Where the App Lives

If the dashboard lives at `hoa-tracker-dashboard/` inside the `hoa-code` repo, you need to tell Vercel that's the root — otherwise it looks at the repo root for `package.json` and doesn't find it.

**How to set it:**
1. Vercel dashboard → Project → Settings → General
2. Find "Root Directory"
3. Set it to `hoa-tracker-dashboard`
4. Save

Now Vercel `cd`s into `hoa-tracker-dashboard/` before running `npm install` and `npm run build`. It treats that subdirectory as if it were the repo root.

This is the equivalent of `cd /var/www/hoa-tracker-dashboard && npm run build` — just scoped for Vercel's build system.

**Combined with the Ignored Build Step:** Vercel sees a push, checks if `hoa-tracker-dashboard/` changed, and if so, builds from `hoa-tracker-dashboard/`. Clean.

---

## Environment Variables

The dashboard needs two env vars to connect to Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://obveytoovkzjrpzrhrim.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_VOkLzqlScMa7yTxZij1xXA_zATBJuyU
```

The `NEXT_PUBLIC_` prefix is a Next.js convention: it makes the variable available in the browser (client-side JavaScript). Without the prefix, the variable is only available server-side. Since Phase 1 fetches data client-side (browser talks directly to Supabase), both vars need the prefix.

**How to set them in Vercel:**
1. Vercel dashboard → Project → Settings → Environment Variables
2. Add each one:
   - Key: `NEXT_PUBLIC_SUPABASE_URL`, Value: `https://obveytoovkzjrpzrhrim.supabase.co`
   - Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Value: `sb_publishable_VOkLzqlScMa7yTxZij1xXA_zATBJuyU`
3. Set environment to "Production" (and "Preview" if you want preview deployments to work too)
4. Save

Vercel injects these as environment variables during the build and at runtime. This is the equivalent of putting them in `/etc/environment` or a `.env` file on a server — except they're managed in Vercel's dashboard and never committed to the repo.

**For local development** (if you ever run the dashboard locally), you'd put the same values in `hoa-tracker-dashboard/.env.local`. That file is in `.gitignore` so it never gets committed.

---

## Checking Deployment Status and Logs

### Deployment Status

In the Vercel dashboard, each project has a "Deployments" tab. Every push gets a deployment entry showing:
- **Status:** Building / Ready / Error
- **When:** timestamp
- **Branch:** which branch triggered it
- **Commit:** the commit message and hash
- **URL:** the deployment URL (production or preview)

A green "Ready" badge means it built and deployed successfully. A red "Error" badge means the build failed.

### Build Logs

Click any deployment to see its build logs. This is like CI output — you see:
```
Cloning github.com/vab-hoa/hoa-code (Branch: main)
Installing dependencies (npm install)
Running build (npm run build)
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages
Deployment ready
```

If the build fails, the logs show the error (TypeScript compilation error, missing dependency, etc.). This is the same output you'd see running `npm run build` locally.

### Runtime Logs

For serverless functions (if you add API routes later), Vercel has a "Logs" tab showing real-time function invocation logs. For Phase 1 (client-side only, no API routes), there won't be server-side logs — all data fetching happens in the browser.

### CLI (optional)

You can install the Vercel CLI if you want:
```bash
npm i -g vercel
```

Then:
```bash
vercel login                    # authenticate
vercel --cwd hoa-tracker-dashboard  # deploy from that directory
vercel logs                      # stream logs
```

This is optional. The dashboard works fine for everything. But if you prefer CLI over clicking through a web UI, it's there.

---

## What Happens When You Leave It

Here's the best part for an infrastructure guy: **nothing**.

- No server to patch
- No OS to upgrade
- No certbot renewal to check
- No nginx to restart
- No disk to monitor
- No memory to watch
- No 3 AM pages because something OOM'd

You push to GitHub. Vercel builds. It's live. It stays live.

If you push again, Vercel rebuilds and swaps to the new version atomically. If the build fails, the old version keeps serving — no downtime from a bad deploy.

If you stop pushing entirely, the site keeps running. It'll sit there serving the last build forever (or until Vercel changes their free tier, which they haven't in years).

The only thing that would require action:
- **Supabase changes their free tier** → you'd need to handle that
- **You want to update the app** → push to GitHub, Vercel rebuilds
- **Vercel's free tier changes** → you'd get an email, and you could migrate to Netlify, Cloudflare Pages, or your own nginx + Node setup

This is the tradeoff: you give up control (no SSH, no OS access, no nginx config) in exchange for giving up responsibility (no patching, no cert management, no server maintenance). For a board dashboard that needs to survive you leaving the HOA board, that's exactly the right trade.

---

## Quick Reference: Vercel vs. Your Stack

| Your Stack | Vercel Equivalent |
|---|---|
| nginx reverse proxy | Vercel's edge proxy (managed, auto-configured) |
| certbot + Let's Encrypt | Vercel's auto-SSL (managed, auto-renewing) |
| `/var/www/html` static files | Vercel CDN edge nodes (replicated globally) |
| `npm run build` on the server | Vercel build container (runs on push) |
| systemd managing Node.js | Vercel serverless functions (if needed) |
| Editing `nginx.conf` | Vercel dashboard settings (or `vercel.json`) |
| `systemctl restart nginx` | Nothing. Deploys are atomic swaps. |
| SSH to check logs | Vercel dashboard → Deployments → Logs |
| DNS CNAME to your server IP | DNS CNAME to `cname.vercel-dns.com` |

---

*That's it. It's a managed platform that does what you'd do with nginx + certbot + a build server, except you don't have to do it. For the HOA dashboard, this is the right tool — cloud-hosted, zero maintenance, survives board turnover.*

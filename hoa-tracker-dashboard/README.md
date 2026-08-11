# HOA Issue Tracker Dashboard

A Next.js-based read-only dashboard for tracking Villas at the Boulders HOA work items, ARC requests, violations, and correspondence.

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Build

```bash
npm run build
```

## Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://obveytoovkzjrpzrhrim.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_VOkLzqlScMa7yTxZij1xXA_zATBJuyU
```

## Deployment to Vercel

1. Create a Vercel project: https://vercel.com/new
2. Import the `vab-hoa/hoa-code` GitHub repo
3. Set **Root Directory** to `hoa-tracker-dashboard`
4. Add environment variables from `.env.local`
5. Deploy
6. Add custom domain `tracker.villasboulders.org` in Vercel project settings
7. Add CNAME record in Namecheap DNS

## Key Pages

- `/` - Dashboard home (aging alerts, summary cards, recent activity)
- `/properties` - Searchable properties list
- `/properties/[id]` - Property detail with work items and source documents
- `/work-items/[id]` - Work item detail with full correspondence and email timeline
- `/emails` - Email inbox with classification filter and search
- `/snapshots` - WO status snapshots and diff view

## Architecture

- **Data fetching**: Client-side with Supabase JS client
- **UI**: Tailwind CSS + Heroicons
- **Database**: Supabase Postgres (read-only Phase 1)
- **No auth**: Phase 1 is board-only access via obscured URL

See the DASHBOARD_SPEC.md in the parent directory for complete specification.

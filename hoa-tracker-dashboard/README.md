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

# For Send Email feature (optional, needed if you want to use the /send page)
GOOGLE_SERVICE_ACCOUNT_B64=<base64-encoded-service-account-json>
```

### Setting up Google Service Account for Email

The `/send` page requires a base64-encoded Google service account JSON:

1. Get the service account JSON file from the GCP project (`villasboulders-automation`)
2. Base64-encode it: `base64 < /path/to/service-account.json | tr -d '\n'`
3. Add the encoded value to `.env.local` as `GOOGLE_SERVICE_ACCOUNT_B64`
4. The service account must have domain-wide delegation enabled with `gmail.send` scope
5. The account impersonates `admin@villasboulders.org` to send from any `@villasboulders.org` address

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
- `/send` - Board email composer (requires `GOOGLE_SERVICE_ACCOUNT_B64` env var)

## Architecture

- **Data fetching**: Client-side with Supabase JS client
- **UI**: Tailwind CSS + Heroicons
- **Database**: Supabase Postgres (read-only Phase 1)
- **No auth**: Phase 1 is board-only access via obscured URL

See the DASHBOARD_SPEC.md in the parent directory for complete specification.

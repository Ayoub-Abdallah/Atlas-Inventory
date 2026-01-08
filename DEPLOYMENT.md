# Deployment Guide - Cloudflare Pages

This application uses **NuxtHub** and is designed for **Cloudflare Pages** deployment.

> **Note**: NuxtHub Admin was sunset on December 31, 2025. This guide uses the new self-hosting approach.

## Prerequisites

1. A Cloudflare account
2. Node.js 18+ installed
3. Git repository connected to GitHub

## Deployment Options

### Option 1: Cloudflare Pages Dashboard (Recommended)

This is the easiest method for continuous deployment.

#### Step 1: Create Cloudflare Resources

First, create the required resources locally:

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 Database
npx wrangler d1 create atlas-inventory-db
```

**Copy the `database_id` from the output** - you'll need it later.

```bash
# Create KV Namespace
npx wrangler kv:namespace create atlas_inventory_kv
```

**Copy the `id` from the output** - you'll need it later.

#### Step 2: Deploy via Cloudflare Dashboard

1. **Go to Cloudflare Dashboard** → **Workers & Pages**
2. **Click "Create Application"** → **Pages** → **Connect to Git**
3. **Select your repository**: `Atlas-Inventory`
4. **Configure build settings**:
   - **Framework preset**: `Nuxt.js`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave empty)
   - **Node version**: `22`

5. **Click "Save and Deploy"**

#### Step 3: Add Bindings (IMPORTANT!)

After the first deployment:

1. **Go to your Pages project** → **Settings** → **Functions**
2. **Scroll to "Bindings"**
3. **Add D1 Database Binding**:
   - Variable name: `DB`
   - Select your database: `atlas-inventory-db`
4. **Add KV Namespace Binding**:
   - Variable name: `KV`
   - Select your namespace: `atlas_inventory_kv`
5. **Click "Save"**

#### Step 4: Add Environment Variables (Optional)

Go to **Settings** → **Environment variables**:

```
NUXT_HUB_PROJECT_SECRET_KEY=your-random-secret-key-here
```

Generate a random secret key:
```bash
openssl rand -base64 32
```

#### Step 5: Redeploy

After adding bindings, trigger a new deployment:
- Go to **Deployments**
- Click **"Retry deployment"** on the latest build

### Option 2: CLI Deployment

For manual deployments from your local machine:

#### Step 1: Create Resources (if not done)

```bash
npx wrangler login
npx wrangler d1 create atlas-inventory-db
npx wrangler kv:namespace create atlas_inventory_kv
```

#### Step 2: Update wrangler.toml

Edit `wrangler.toml` and replace the placeholder IDs:

```toml
[[d1_databases]]
binding = "DB"
database_name = "atlas-inventory-db"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # From step 1

[[kv_namespaces]]
binding = "KV"
id = "YOUR_ACTUAL_NAMESPACE_ID"  # From step 1
```

#### Step 3: Build and Deploy

```bash
# Build for Cloudflare Pages
npm run build

# Deploy to Pages
npm run deploy
```

Or combined:
```bash
npm run deploy
```

## Database Setup

After deployment, you need to initialize your database:

### Option 1: Run Migrations via Wrangler

```bash
# Apply migrations to production database
npx wrangler d1 migrations apply atlas-inventory-db --remote
```

### Option 2: Use the Admin Setup Page

1. Visit your deployed app: `https://your-app.pages.dev/auth/setup`
2. Create your first admin account
3. This will automatically initialize the database schema

## Environment Variables

Set these in Cloudflare Pages Dashboard → Settings → Environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `NUXT_HUB_PROJECT_SECRET_KEY` | Random secret for remote storage auth | Recommended |
| `NUXT_ADMIN_SECRET_KEY` | Admin operations secret | Optional |

## Troubleshooting

### Build succeeds but app shows 404
- **Cause**: Missing bindings (DB/KV)
- **Fix**: Add bindings in Settings → Functions → Bindings

### Database errors on runtime
- **Cause**: Database not initialized
- **Fix**: Visit `/auth/setup` to initialize

### "Missing DB binding" error
- **Cause**: D1 binding not configured
- **Fix**: Add DB binding with variable name `DB`

### Blank page / White screen
- **Cause**: Build output directory mismatch
- **Fix**: Ensure build output directory is set to `dist`

## Custom Domain

To add a custom domain:

1. Go to **Custom domains** in your Pages project
2. Click **"Set up a custom domain"**
3. Enter your domain and follow DNS instructions

## Important Notes

- **Build output directory**: Must be `dist` (not `.output/public`)
- **Framework preset**: Nuxt.js (uses Nitro preset for Cloudflare Pages)
- **Node version**: 22.x (specified in package.json)
- **Bindings**: Must be added AFTER first deployment
- **Always redeploy** after changing bindings or environment variables

## Production Checklist

- [ ] D1 database created and bound
- [ ] KV namespace created and bound
- [ ] Environment variables configured
- [ ] Database initialized via `/auth/setup`
- [ ] Custom domain configured (optional)
- [ ] SSL/HTTPS enabled (automatic)

## Why Not Vercel?

This app is specifically built for Cloudflare's infrastructure:
- **D1 Database**: Cloudflare's SQLite database (no Vercel equivalent)
- **NuxtHub**: Designed for Cloudflare ecosystem
- **KV Storage**: Cloudflare KV (different from Vercel KV)

Migrating to Vercel would require:
- Complete database rewrite (D1 → Postgres)
- Removing NuxtHub dependencies
- Rewriting all database queries

**Not recommended** - stick with Cloudflare Pages.

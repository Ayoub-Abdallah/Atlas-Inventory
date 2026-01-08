# Deployment Guide

This application uses **NuxtHub** and is designed to be deployed on **Cloudflare Pages**.

## Prerequisites

1. A Cloudflare account
2. Wrangler CLI installed (already in devDependencies)
3. D1 database created on Cloudflare

## Deploy to Cloudflare Pages

### Option 1: Using the Deploy Script (Recommended)

```bash
npm run deploy:cf
```

This will:
1. Build the app with Cloudflare Pages preset
2. Deploy to Cloudflare Pages using Wrangler

### Option 2: Using NuxtHub Admin

1. Go to [NuxtHub Admin](https://admin.hub.nuxt.com)
2. Connect your GitHub repository
3. NuxtHub will automatically deploy your app

### Option 3: Manual Deployment

1. **Login to Wrangler:**
   ```bash
   npx wrangler login
   ```

2. **Create D1 Database:**
   ```bash
   npx wrangler d1 create atlas_inventory_db
   ```

3. **Update wrangler.toml** with your database ID

4. **Deploy:**
   ```bash
   npm run deploy:cf
   ```

## Environment Variables

Set these in Cloudflare Pages dashboard:

- `NUXT_ADMIN_SECRET_KEY`: Your admin secret key
- Any other secrets your app needs

## Why Not Vercel?

This app uses:
- **Cloudflare D1**: SQLite database (Vercel uses Postgres)
- **Cloudflare KV**: Key-value storage (Vercel KV is different)
- **NuxtHub**: Built specifically for Cloudflare infrastructure

Vercel deployment would require significant changes to use Vercel Postgres instead of D1.

## Alternative: Adapt for Vercel

If you must use Vercel, you would need to:

1. Replace Cloudflare D1 with Vercel Postgres
2. Replace Cloudflare KV with Vercel KV
3. Remove `@nuxthub/core` module
4. Rewrite all database queries for Postgres
5. Update session storage to use Vercel KV

This is a major refactor and not recommended.

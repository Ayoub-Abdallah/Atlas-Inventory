# Quick Start: Deploy to Cloudflare Pages

Follow these steps to deploy Atlas Inventory to Cloudflare Pages.

## 📋 Pre-Deployment Setup

### 1. Create D1 Database

```bash
npx wrangler login
npx wrangler d1 create atlas-inventory-db
```

**Save the output** - you'll see something like:
```
database_id = "abc123-def456-ghi789"
```

### 2. Create KV Namespace

```bash
npx wrangler kv:namespace create atlas_inventory_kv
```

**Save the output** - you'll see:
```
id = "xyz789abc123def456"
```

## 🚀 Deploy via Cloudflare Dashboard

### Step 1: Connect Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Click **"Create Application"**
4. Select **"Pages"** tab
5. Click **"Connect to Git"**
6. Authorize GitHub and select: `Ayoub-Abdallah/Atlas-Inventory`

### Step 2: Configure Build

Set these build settings:

| Setting | Value |
|---------|-------|
| Framework preset | `Nuxt.js` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (leave empty) |
| Node version | `22` |

Click **"Save and Deploy"**

⏳ Wait for the first build to complete (it will fail at runtime - that's expected!)

### Step 3: Add Bindings ⚠️ CRITICAL

After the first deployment:

1. Go to your project → **Settings** → **Functions**
2. Scroll down to **"Bindings"** section

#### Add D1 Database:
- Click **"Add binding"** under D1 databases
- **Variable name**: `DB`
- **D1 database**: Select `atlas-inventory-db`
- Click **"Save"**

#### Add KV Namespace:
- Click **"Add binding"** under KV namespaces
- **Variable name**: `KV`
- **KV namespace**: Select `atlas_inventory_kv`
- Click **"Save"**

### Step 4: Add Environment Variable (Optional but Recommended)

1. Go to **Settings** → **Environment variables**
2. Click **"Add variable"**
3. Add this variable for all environments (Production, Preview):

```
NUXT_HUB_PROJECT_SECRET_KEY
```

Generate a random value:
```bash
openssl rand -base64 32
```

Or use any random string (32+ characters)

### Step 5: Redeploy

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **"···"** (three dots) → **"Retry deployment"**

⏳ Wait for build to complete

### Step 6: Initialize Database

1. Visit your deployed app: `https://atlas-inventory-xxx.pages.dev`
2. You'll be redirected to: `/auth/setup`
3. Create your first admin account:
   - **Email**: your-email@example.com
   - **Password**: choose a strong password
4. Click **"Create Admin Account"**

✅ **Done!** Your app is now live and ready to use.

## 🔧 Troubleshooting

### Issue: "404 NOT_FOUND" after deployment
**Cause**: Bindings not configured  
**Fix**: Add DB and KV bindings (Step 3 above)

### Issue: Blank white page
**Cause**: Build output directory wrong  
**Fix**: Ensure it's set to `dist` (not `.output/public`)

### Issue: Database errors
**Cause**: Database not initialized  
**Fix**: Visit `/auth/setup` and create admin account

### Issue: Build fails with wrangler error
**Cause**: Wrong deployment command  
**Fix**: Cloudflare Pages uses automatic build, ignore wrangler errors in logs

## 📱 Custom Domain Setup

1. Go to **Custom domains**
2. Click **"Set up a custom domain"**
3. Enter your domain: `inventory.yourdomain.com`
4. Add the CNAME record to your DNS:
   ```
   inventory.yourdomain.com → atlas-inventory-xxx.pages.dev
   ```
5. Wait for SSL certificate (automatic, ~15 minutes)

## 🔐 Production Checklist

- [ ] D1 database created
- [ ] KV namespace created  
- [ ] GitHub repository connected
- [ ] Build settings configured (framework: Nuxt.js, output: dist)
- [ ] D1 binding added (variable: DB)
- [ ] KV binding added (variable: KV)
- [ ] Environment variable added (NUXT_HUB_PROJECT_SECRET_KEY)
- [ ] Redeployed after adding bindings
- [ ] Database initialized via /auth/setup
- [ ] Admin account created
- [ ] Custom domain configured (optional)

## 📝 Important Notes

- **First deployment will fail** - this is normal, bindings must be added manually
- **Always redeploy** after changing bindings or environment variables
- **Build output must be `dist`** - this is the Nitro output for Cloudflare Pages
- **Node version should be 22** - for best compatibility

## 🆘 Need Help?

Check the full deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)

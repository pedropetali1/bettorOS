# Vercel Deployment Guide for BettorOS

This guide will help you deploy your BettorOS application to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. A PostgreSQL database (Supabase, Railway, or any PostgreSQL provider)

## Step 1: Prepare Your Repository

Make sure your code is committed and pushed to your Git repository:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your Git repository
4. Vercel will auto-detect Next.js settings
5. **Do not click Deploy yet** - we need to set environment variables first

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

## Step 3: Configure Environment Variables

In your Vercel project dashboard, go to **Settings → Environment Variables** and add:

### Required Environment Variables

1. **`DATABASE_URL`**
   - Your PostgreSQL connection string (pooler URL)
   - Example: `postgresql://user:password@host:port/database?pgbouncer=true`

2. **`DIRECT_URL`**
   - Direct PostgreSQL connection string (for migrations)
   - Example: `postgresql://user:password@host:port/database`
   - **Important**: This should be the direct connection, not the pooler URL

3. **`AUTH_SECRET`**
   - A random secret string for NextAuth.js
   - Generate one using:
     ```bash
     openssl rand -base64 32
     ```
   - Or use: https://generate-secret.vercel.app/32

4. **`AUTH_URL`** (Optional but recommended)
   - Your production URL
   - Example: `https://your-app.vercel.app`
   - If not set, NextAuth will try to auto-detect it

### Setting Environment Variables in Vercel

1. Go to your project in Vercel dashboard
2. Navigate to **Settings → Environment Variables**
3. Add each variable:
   - **Key**: The variable name (e.g., `DATABASE_URL`)
   - **Value**: The variable value
   - **Environment**: Select all (Production, Preview, Development)
4. Click **Save**

## Step 4: Run Database Migrations

After deployment, you need to run Prisma migrations on your production database:

### Option A: Using Vercel CLI

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Pull environment variables:
   ```bash
   vercel env pull .env.local
   ```

3. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

### Option B: Using Prisma Studio or Direct Connection

1. Set your `DATABASE_URL` and `DIRECT_URL` in your local `.env` file
2. Run:
   ```bash
   npx prisma migrate deploy
   ```

### Option C: Using Vercel Build Command (Recommended)

You can automate migrations by updating your build command in Vercel:

1. Go to **Settings → General → Build & Development Settings**
2. Update **Build Command** to:
   ```bash
   npx prisma migrate deploy && next build
   ```

**Note**: This requires `DIRECT_URL` to be set in Vercel environment variables.

## Step 5: Verify Deployment

1. Visit your deployed URL (e.g., `https://your-app.vercel.app`)
2. Test the registration flow
3. Test the login flow
4. Verify database operations work correctly

## Step 6: Set Up Custom Domain (Optional)

1. Go to **Settings → Domains**
2. Add your custom domain
3. Follow Vercel's DNS configuration instructions

## Troubleshooting

### Build Fails with Prisma Errors

- Ensure `postinstall` script is in `package.json` (already added)
- Check that `DATABASE_URL` and `DIRECT_URL` are set correctly
- Verify database is accessible from Vercel's IP ranges

### Authentication Not Working

- Verify `AUTH_SECRET` is set
- Check `AUTH_URL` matches your production domain
- Ensure database migrations have been run (Session and Account tables exist)

### Database Connection Issues

- Verify `DATABASE_URL` uses the pooler connection
- Verify `DIRECT_URL` uses direct connection (for migrations)
- Check if your database provider allows connections from Vercel's IPs
- For Supabase: Make sure you're using the pooler URL for `DATABASE_URL`

### Migration Issues

- Ensure `DIRECT_URL` is set (required for migrations)
- Run `npx prisma migrate deploy` manually if build command fails
- Check Prisma migration status: `npx prisma migrate status`

## Additional Notes

- **Build Time**: The `postinstall` script automatically runs `prisma generate` during build
- **Migrations**: Run `prisma migrate deploy` for production (not `prisma migrate dev`)
- **Environment Variables**: All environment variables are encrypted in Vercel
- **Preview Deployments**: Each pull request gets a preview deployment with the same environment variables

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check function logs in Vercel dashboard
3. Verify all environment variables are set correctly
4. Ensure database is accessible and migrations are applied

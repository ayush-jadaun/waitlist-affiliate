# Deploy the Admin Dashboard to Vercel

The admin dashboard (`apps/admin`) is a Next.js app that talks to the
Waitlist API. Deploy it to Vercel for zero-config hosting, instant previews,
and free TLS.

---

## Prerequisites

- [Vercel account](https://vercel.com) (free Hobby tier is sufficient)
- [Vercel CLI](https://vercel.com/docs/cli) installed:
  ```bash
  npm install -g vercel
  vercel login
  ```
- The Waitlist API deployed and accessible (Railway, Fly.io, your own server, etc.)

---

## Option A: Deploy from GitHub (recommended)

### 1. Push to GitHub

```bash
git remote add origin https://github.com/your-org/waitlist-referral.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select `waitlist-referral`
4. **Root Directory**: set to `apps/admin`
5. **Framework Preset**: Next.js (auto-detected)
6. Click **"Deploy"**

### 3. Set environment variables

In your Vercel project → **Settings** → **Environment Variables**:

| Variable | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-api.railway.app` | Production, Preview, Development |
| `NEXTAUTH_SECRET` | `openssl rand -base64 48` | Production, Preview, Development |
| `NEXTAUTH_URL` | `https://your-admin.vercel.app` | Production |

> `NEXT_PUBLIC_API_URL` must be the publicly accessible URL of your API server —
> Vercel's build servers and end-user browsers both need to reach it.

### 4. Redeploy

After setting environment variables, trigger a new deployment:

**Deployments** tab → **"…"** → **Redeploy**

---

## Option B: Deploy via CLI

```bash
cd apps/admin

# First deploy (creates the project on Vercel)
vercel

# Follow the prompts:
#   Set up and deploy: Y
#   Which scope: (select your account or team)
#   Link to existing project: N
#   Project name: waitlist-admin
#   Directory: ./  (you're already in apps/admin)
#   Override settings: N

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
# Enter value: https://your-api.railway.app

vercel env add NEXTAUTH_SECRET production
# Enter value: (output of openssl rand -base64 48)

# Deploy to production
vercel --prod
```

---

## Monorepo configuration

Because `apps/admin` is inside a monorepo, Vercel needs to know the root
directory. `vercel.json` at the repo root handles this, but you can also
configure it in the Vercel dashboard:

**Settings** → **General** → **Root Directory** → `apps/admin`

And set the build command:

```
cd ../.. && pnpm --filter @waitlist/admin build
```

Or if you use Turborepo:

```
cd ../.. && pnpm turbo build --filter=@waitlist/admin
```

---

## Custom domain

1. Go to your Vercel project → **Settings** → **Domains**
2. Click **"Add"** and enter your domain (e.g., `admin.myapp.com`)
3. Follow the DNS instructions:
   - Add a `CNAME` record pointing to `cname.vercel-dns.com`, or
   - Use Vercel Nameservers for automatic management

Vercel provisions a TLS certificate automatically within minutes.

---

## Preview deployments

Every pull request automatically gets a unique preview URL:

```
https://waitlist-admin-git-feature-your-org.vercel.app
```

Preview deployments use the **Preview** environment variables.
Set them separately from Production in **Settings** → **Environment Variables**
to point at a staging API:

| Variable | Preview value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-api-staging.railway.app` |

---

## CORS configuration

The API must allow requests from the admin dashboard origin.
Update the `ALLOWED_ORIGINS` environment variable on your API server:

```bash
# On Railway
railway variables set ALLOWED_ORIGINS=https://admin.myapp.com,https://waitlist-admin.vercel.app

# Or in your .env on a VPS
ALLOWED_ORIGINS=https://admin.myapp.com,https://waitlist-admin.vercel.app
```

---

## Securing the admin dashboard

The admin dashboard uses JWT authentication against the API. The JWT is
issued by `POST /api/v1/admin/auth/login` and stored in the browser.

For extra security:

1. **IP allowlisting** — use Vercel's [Edge Middleware](https://vercel.com/docs/functions/edge-middleware)
   to restrict access by IP:

   ```typescript
   // middleware.ts (at apps/admin root)
   import { NextResponse } from "next/server";
   import type { NextRequest } from "next/server";

   const ALLOWED_IPS = (process.env.ALLOWED_IPS ?? "").split(",");

   export function middleware(req: NextRequest) {
     const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
     if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(ip)) {
       return new NextResponse("Forbidden", { status: 403 });
     }
     return NextResponse.next();
   }

   export const config = { matcher: "/((?!_next|favicon.ico).*)" };
   ```

2. **Vercel Authentication** — enable Vercel's built-in password protection
   under **Settings** → **Deployment Protection** (Pro plan).

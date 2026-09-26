# Moving to Neon (database) and Cloudinary (images)

Two accounts are needed — I can't create third-party accounts on your behalf,
so this half is yours. Once the two `.env` sections below are filled in, tell
me and I'll do everything else: create the schema on Neon, copy every row
from your local database across, and move the uploaded images to Cloudinary.

## 1. Neon (free tier)

1. Go to <https://console.neon.tech> and sign up / sign in.
2. Create a project (any name, e.g. `t1dpe`). Pick a region close to your
   users (e.g. `ap-southeast-1` for India).
3. On the project's **Dashboard → Connection string**, Neon gives you a
   **pooled** string and you can toggle a **direct** (unpooled) one:
   - Copy the **pooled** string into `DATABASE_URL`.
   - Copy the **direct** string into `DIRECT_DATABASE_URL` (Prisma migrations
     need the direct connection; the app itself uses the pooled one).
4. Open `api/.env` and set:
   ```
   DATABASE_URL="<pooled connection string, ends with ...&pgbouncer=true>"
   DIRECT_DATABASE_URL="<direct connection string>"
   ```

Neon's free tier is one project, 0.5 GB storage, which is comfortably more
than this study's current data.

## 2. Cloudinary (free tier)

1. Go to <https://cloudinary.com> and sign up / sign in (no card required on
   the free tier — 25 GB storage and 25 GB monthly bandwidth, comfortably
   covering this app's images).
2. On the **Dashboard**, the **Product Environment Credentials** panel shows
   your **Cloud name**, **API Key** and **API Secret** (click "reveal" for the
   secret).
3. Open `api/.env` and set:
   ```
   CLOUDINARY_CLOUD_NAME="<cloud name>"
   CLOUDINARY_API_KEY="<api key>"
   CLOUDINARY_API_SECRET="<api secret>"
   ```

No bucket, public-access toggle, or custom domain to set up — Cloudinary
serves every uploaded object from `https://res.cloudinary.com/<cloud name>/...`
automatically, and the app computes that URL itself.

## 3. What happens once you say the `.env` is filled in

1. `npx prisma migrate deploy` against Neon — creates every table.
2. Every row from the local development database is copied across
   (`pg_dump` from the local Postgres container, restored into Neon) —
   participants, content, quizzes, everything.
3. `scripts/upload-content-images.ts` — uploads the Help Book's local
   `/content/...` images to Cloudinary and repoints the articles at the new
   URLs.
4. `scripts/migrate-local-uploads-to-cloudinary.ts` — the admin-uploaded
   thumbnails currently sitting in `.local-uploads/` (the local-dev fallback
   used before Cloudinary was configured) are uploaded to Cloudinary too, and
   the `EducationContent` rows that point at them are repointed.
5. `scripts/verify-cloud-migration.ts` checks row counts, table by table,
   between the local database and Neon, so nothing silently goes missing.

Nothing in this file is a secret — the actual values only ever go into
`api/.env`, which is already git-ignored.

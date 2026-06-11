# Dadi Prompt Library Backend Setup Guide

This package adds backend access to the Dadi Prompt Library using:

- Vercel React frontend
- Vercel Serverless API routes in `/api`
- Supabase database
- Admin key protection for review, approve, archive, delete, bulk seed, and export actions

## 1. Create a Supabase project

1. Go to Supabase.
2. Create a new project.
3. Open **SQL Editor**.
4. Copy and run the SQL from:

```text
supabase/schema.sql
```

This creates:

```text
prompts
prompt_activity_logs
```

## 2. Get Supabase keys

In Supabase, open:

```text
Project Settings > API
```

Copy:

```text
Project URL
service_role key
```

Important: The service role key must stay server-side only. Do not paste it into React frontend code.

## 3. Add Vercel Environment Variables

In Vercel, open:

```text
Project > Settings > Environment Variables
```

Add:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_KEY
```

Use a strong private value for `ADMIN_KEY`, for example:

```text
DadiPromptAdmin_2026_Private_Long_Key
```

## 4. Upload these files to GitHub

Upload this full package to the repository root:

```text
index.html
package.json
vite.config.js
vercel.json
README.md
UPLOAD_INSTRUCTIONS.txt
.env.example
api/
public/
src/
supabase/
docs/
```

Expected structure:

```text
api/
  _supabase.js
  admin-prompts.js
  bulk-upload-prompts.js
  export-prompts.js
  health.js
  prompts.js
public/
  dadi-coach-logo.png
  prompts.json
src/
  main.jsx
  App.jsx
  styles.css
supabase/
  schema.sql
```

## 5. Deploy to Vercel

Vercel settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Use this commit message:

```text
Add Supabase backend access for prompt library
```

## 6. Test backend access

After deployment, open:

```text
https://your-domain.vercel.app/api/health
```

If configured correctly, it should return:

```json
{
  "ok": true,
  "database": "connected",
  "prompt_count": 0
}
```

## 7. Seed the 1,000 prompts into Supabase

1. Open the website.
2. Click **Admin Access**.
3. Enter your `ADMIN_KEY`.
4. Click **Test Backend**.
5. Click **Seed Current 1,000 Prompts**.
6. Click **Refresh List**.

After seeding, the website will load approved prompts from the backend automatically. If the backend is unavailable, it falls back to `public/prompts.json`.

## 8. Admin workflow

The admin page supports:

- Test Backend
- Seed Current 1,000 Prompts
- Load all prompts
- Approve prompts
- Mark prompts as Pending
- Archive prompts
- Delete prompts
- Export backend prompts as Excel-compatible `.xls`

## 9. Contributor workflow

Users can still upload JSON/CSV prompts through the frontend. For a true shared upload workflow, connect the upload function to `/api/prompts`. The included API accepts POST requests and saves non-admin submissions as `pending_review`.

## 10. Security reminder

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend files.
- Keep `ADMIN_KEY` private.
- Rotate `ADMIN_KEY` if shared accidentally.
- Use Supabase Auth later if you want staff-specific accounts and roles.

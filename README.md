# Dadi Prompt Library Premium v9

Premium Dadi-branded prompt library for internal AI prompt templates.

## Included features

- Premium dashboard-style prompt library UI
- Hidden admin access: `/admin` only, no admin button in normal navigation
- Green, Yellow, and Clean themes based on the Dadi Coach logo colors
- Search, category filters, structure filters, favorites, prompt detail modal, and copy buttons
- Prompt Assistant with local prompt search and role-based prompt drafting
- Improve Prompt page with score breakdown
- Upload JSON/CSV prompts
- Download all prompts as Excel-compatible `.xls`
- Optional Supabase backend via Vercel API routes

## Deployment

Upload all files and folders to the GitHub repository root, then deploy with Vercel.

Required structure:

```text
index.html
package.json
vite.config.js
vercel.json
README.md
UPLOAD_INSTRUCTIONS.txt
.env.example
public/
  dadi-coach-logo.png
  prompts.json
src/
  main.jsx
  App.jsx
  styles.css
api/
supabase/
docs/
```

## Hidden admin page

Normal users will not see an Admin Access button.
Authorized admins can open:

```text
https://your-domain.vercel.app/admin
```

Admin backend actions still require `ADMIN_KEY` configured in Vercel Environment Variables.

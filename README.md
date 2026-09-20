# Cancún 2027 — landing page

Static page + one serverless function. No framework, no build step.

```
public/index.html    the page
public/img/          photos (swap freely, keep the filenames)
api/signup.js        receives both forms, stores + emails
package.json         one dependency (Neon driver)
schema.sql           run once against your database
```

## Deploy

```bash
npm i -g vercel      # if you don't have it
vercel               # first run links the project
vercel --prod
```

## Environment variables

Vercel → Project → Settings → Environment Variables. **Redeploy after adding them** —
env changes don't apply to existing deployments.

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | from resend.com → API Keys |
| `NOTIFY_EMAIL` | cancun2027.ryan@gmail.com |
| `DATABASE_URL` | set automatically by `vercel install neon` |

Both storage paths are optional and independent:

- **Email only** — set the two Resend vars, skip the database. Your inbox is the list.
- **Database only** — run `vercel install neon`, apply `schema.sql`, skip Resend.

With neither set, the function returns 200 and the form shows success but nothing
is saved anywhere. Submit the form once after your first deploy and confirm the
email actually arrives.

## Custom domain

Settings → Domains → Add → `cancun2027.ryanrauch.com`, then add the CNAME record
Vercel displays at your DNS provider.

## Editing the page

Everything lives in `public/index.html`.

- **Photos** — `PHOTOS` object near the bottom. Replace files in `public/img/`
  keeping the same names and nothing else changes. Wide tiles render 16:9, the
  rest 4:3. A missing file falls back to a labeled placeholder showing which
  slot it belongs to.
- **Rooms and prices** — the `.room` blocks in the "Rooms & rates" section. Add
  `class="room taken"` and a `<span class="tag">Taken</span>` to mark one gone,
  and disable its `<option>` in the application form.
- **Colors** — the CSS variables in `:root` at the top.
- **Where the form posts** — `CONFIG.ENDPOINT`, currently `/api/signup`.

## Note on spam

The endpoint has no rate limiting or bot protection. Fine for a link you text to
friends. If it ends up somewhere public, add a honeypot field or Vercel's bot
filter before someone finds it.

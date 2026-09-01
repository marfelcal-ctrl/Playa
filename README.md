# Personal Tracker — Supabase Multi-User Edition

Personal Tracker is a GitHub Pages-compatible dark web app for Bills, Budget, Time Stamp tracking, and an Audiomack music player.

## What changed in this version

- Supabase email/password registration and login
- Persistent login session
- Forgot-password flow
- Each user's Bills, Budget, and Time Stamp data is stored in Supabase
- Row Level Security (RLS): normal users can access only their own data
- `user` and `admin` roles
- Admin-only dashboard for registered users, roles, and account enable/disable controls
- Optional migration of previous browser `localStorage` Personal Tracker data
- Time Stamp CSV export, JSON backup, and CSV/JSON import
- Time Stamp Details / Notes
- Running Work Time continues during Break / Away
- History Work Duration deducts Break / Away time
- Audiomack's native player controls only

## 1. REQUIRED — Create the database tables

Before the new website can load an account, open:

**Supabase Dashboard → SQL Editor → New query**

Copy everything from `supabase-schema.sql`, paste it into the query, and click **Run**.

This creates:

- `profiles`
- `budgets`
- `bills`
- `time_entries`
- Auth profile trigger
- Row Level Security policies
- Admin helper functions

## 2. Register your own Personal Tracker account

Deploy/open the website and choose **Register**.

If Supabase email confirmation is enabled, confirm your email first.

## 3. Make your account Admin

After your account has registered, open **Supabase → SQL Editor** and run:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR-LOGIN-EMAIL@example.com';
```

Replace the email with the email you used to register.

Log out and log back in. The **Admin** tab will appear.

Do not automatically make the first visitor an admin; manually assigning your own account is safer.

## 4. GitHub Pages Auth URL configuration

After GitHub Pages is live, copy your real site address, for example:

`https://YOUR-USERNAME.github.io/personal-tracker/`

Then in Supabase open **Authentication → URL Configuration** and set:

- **Site URL**: your GitHub Pages URL
- **Redirect URLs**: add the same GitHub Pages URL

This is needed for email confirmation and password-reset links.

## 5. Files to upload to GitHub

Upload these files to the repository root:

- `index.html`
- `style.css`
- `script.js`
- `supabase-schema.sql`
- `README.md`

Then publish the `main` branch from `/ (root)` using GitHub Pages.

## Supabase key safety

`script.js` contains the Supabase Project URL and the `sb_publishable_...` key. A publishable key is intended for browser/client applications. Security is enforced by database grants and RLS policies.

Never put any of these in GitHub frontend files:

- `sb_secret_...`
- `service_role`
- database password
- Postgres connection password

## Data model

### profiles
One row per registered account, containing display name, email, role, and active/disabled state.

### budgets
One current budget row per user.

### bills
Multiple bills per user.

### time_entries
One row per user per work date. A date can have one Time In, one Time Out, and multiple Break/Away sessions stored as JSON.

## Timer behavior

- **Running Work Time** = full elapsed time from Time In to now/Time Out. Breaks do not pause it.
- **Break / Away Used** = total break duration against the 1 hour 30 minute allowance.
- **Work Duration in history** = elapsed shift time minus Break/Away duration.

## Previous Personal Tracker data

If the browser still contains the old `pt_bills_v1`, `pt_budget_v1`, or `pt_time_v1` localStorage records, a migration banner appears after login. **Import old data** copies those records into the signed-in Supabase account. It does not delete the old local copy.

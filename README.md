# Personal Tracker

A dark dashboard web application for Bills, Budget, Time Stamp tracking, and an Audiomack music player.

## Current features

- Bills with due dates, payment status, and smart priority ranking
- Budget with income, overtime, holiday pay, credits, savings, and deductions
- Budget total automatically feeds the Bills tab
- Time In once per day
- Time Out once per day
- Multiple Break / Away sessions
- Running elapsed time continues during breaks
- Net work duration deducts breaks
- 1 hour 30 minute Break / Away allowance tracker
- Time history Details/Notes field
- Export Time Stamp data to CSV
- Export exact Time Stamp backup to JSON
- Import CSV or JSON and merge it into Time Stamp history
- Audiomack Weekly 100: Philippines embedded player using Audiomack's own playback controls
- Browser localStorage persistence

## Importing Time Stamp data

The easiest workflow is:

1. Open Time Stamp.
2. Click **Export CSV**.
3. Edit the file in Excel or Google Sheets.
4. Keep the `date` column in `YYYY-MM-DD` format.
5. Edit `time_in`, `time_out`, `breaks`, and `details` as needed.
6. Click **Import File** and select the edited CSV.

For an exact backup/restore, use **Export Backup** to create a JSON file.

## Multi-user upgrade

The current version stores data in each browser using localStorage. For accounts, registration, synchronized data, and an admin dashboard, migrate storage to a backend such as Supabase Auth + Postgres with Row Level Security.

Recommended role model:

- `user`: can access only their own Bills, Budget, and Time Stamp records
- `admin`: can open an Admin Dashboard and manage allowed user/account functions

Keep the regular user dashboard and admin dashboard in the same project, with admin routes/views hidden and protected by authorization checks.

## GitHub Pages

Upload `index.html`, `style.css`, `script.js`, and this `README.md` to the root of your GitHub repository and publish the `main` branch from `/ (root)` in GitHub Pages.

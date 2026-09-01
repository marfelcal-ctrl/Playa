# Personal Tracker

A lightweight personal dashboard for bills, budgeting, work timestamps, and music.

## Features

- **Bills**: add bills, mark paid/unpaid, see totals, remaining budget, and a generated payment-priority order.
- **Budget**: base income, overtime, holiday premium, credits, savings, government deductions, late/absence/overbreak deductions, and miscellaneous deductions.
- **Time Stamp**: one Time In and one Time Out per date, multiple Break/Away entries, running work timer, 1h30m break allowance meter, and time history.
- **Music**: Audiomack Weekly 100: Philippines embedded at the bottom of the application.
- **Storage**: all data is stored in the current browser using `localStorage`.

## Smart bill priority logic

The first version is deterministic and does not require an AI API key. It gives higher priority to:

1. Overdue bills
2. Bills due very soon
3. Essential bills
4. Debt / credit obligations
5. Higher-value bills as a smaller tie-breaker

This can later be upgraded to an OpenAI-powered financial planning assistant.

## Run locally

Open `index.html` directly, or use VS Code Live Server.

## Deploy to GitHub Pages

1. Create a GitHub repository named `personal-tracker`.
2. Upload `index.html`, `style.css`, `script.js`, and `README.md`.
3. Open repository **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose `main` and `/ (root)`, then save.

## Important data note

Because this version uses `localStorage`, your data stays only in the browser/device where you entered it. Clearing browser storage will remove it. A future version can use Firebase, Supabase, or another database for login, cloud sync, and backup.

## Audiomack note

The app embeds the Audiomack playlist at:
`https://audiomack.com/geo-charts/playlist/philippines`

Audiomack runs in a cross-origin iframe. Browser security prevents the parent Personal Tracker page from reading the exact currently-playing song title from inside that iframe unless Audiomack exposes a supported player messaging/API integration for it. The embedded Audiomack player itself displays its own playback information.

## Music player controls

The Music Player includes Previous, Play/Pause, Next, Mute and a 0–100% volume slider above the Audiomack Weekly 100: Philippines embed. The controls use cross-frame Player.js messages where the Audiomack embed supports them. Audiomack's built-in controls remain available inside the embedded player as a fallback.


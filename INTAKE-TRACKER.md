# Intake Tracker (water / calories / protein)

A home-screen web app (PWA) in `intake-tracker/`, with Netlify Functions in `netlify/functions/` for background water reminders.

## Deploy
1. Push this repo to GitHub and import it in Netlify (settings come from `netlify.toml`).
2. Generate VAPID keys once: `npx web-push generate-vapid-keys`
3. In Netlify → Site settings → Environment variables add:
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (from step 2)
   - `VAPID_SUBJECT` = `mailto:you@example.com`
4. Redeploy.

## iPhone
Open the site in **Safari → Share → Add to Home Screen**, launch it from the home screen, then ⚙︎ → turn on *Remind me to drink water* and allow notifications (iOS 16.4+ required; only works from the installed app).

Data (your logs) is stored on-device in localStorage. The server only stores your push subscription, reminder window, and today's water total so it can skip reminders once you've hit your goal.

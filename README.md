# Household Budget

A friendly budget tracker for two people. It tracks every income source you each have (jobs, side jobs, freelance, hobbies), your everyday spending, and your bills. From those it forecasts your household's monthly income, spending, and the gap between them.

It's a single `index.html` with no build step.

## Features

- **Income**: each person has their own income sources. A source is either *steady* (it forecasts from your monthly estimate) or *varies* (it forecasts from your last 3 full months, with your estimate as a fallback until you've logged a few months).
- **Expenses**: log spending by category and by who paid (either person or shared).
- **Bills**: recurring bills can be weekly, every 2 weeks, monthly, every 3 months, or yearly. Marking a bill paid logs it as that month's expense.
- **Charts & data**:
  - An income vs. spending line chart covering the last 12 months plus a 3-month forecast. The gap between the lines is shaded green when you're ahead and orange when spending runs over.
  - Income by person, income by kind of work, and spending by category.
- A month switcher, a backup/restore to JSON, and sample data.

## Run it

Open `index.html` in a browser, or deploy it (below). Sign in with the shared login on each device and both see the same budget, updated live. Data is also cached in the browser, so the last-loaded budget still shows if you're offline.

To run it with no sync at all, blank out `SUPABASE_URL` and `SUPABASE_KEY` near the top of the script.

## Deploy

**Vercel**: import the repo. Choose "Other" as the framework preset, no build command, output directory `.`.

**GitHub Pages**: Settings → Pages → Deploy from branch → `main` / root.

## Sync (Supabase)

The backend lives in the Smalljoy Supabase project, in tables prefixed `budget_` so they stay separate from Smalljoy's own. The schema is in `supabase/schema.sql` and has already been applied.

How it works:
- One shared login for the household. The first sign-in creates the household row and moves whatever was on that device into it.
- All reads and writes go through `Store` (browser cache) and `Cloud` (Supabase) at the top of the script. Each change saves locally right away and pushes the whole budget as one JSON document a moment later.
- Realtime is on for `budget_households`, so an edit on one phone appears on the other without a refresh.
- Row-level security means only signed-in members of a household can read or change its row. The publishable key in the page is meant to be public.

Last write wins if you both edit at the exact same moment. That's fine for two people; a per-row relational model can come later if it ever matters.

## Data model (inside the JSON document)

| Collection | Fields |
|---|---|
| people | id, name |
| sources | id, personId, name, type (job/side/freelance/hobby), kind (fixed/variable), expected, active |
| income | id, sourceId, date, amount, note |
| expenses | id, date, amount, category, personId (or `shared`), note, billId? |
| bills | id, name, amount, frequency, category, dueDay, personId, active |

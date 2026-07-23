# Atlanta Bridge Kids — Setup Guide

Everything the site does. Follow in order — takes maybe an hour total.

## 1 · GitHub organization + repo

1. In GitHub, click your avatar → **Your organizations** → **New organization** → Free plan.
2. Organization name: `atlbridgekids`.
3. Inside that org, create a new **public** repo named exactly `atlbridgekids.github.io`.
4. Upload every file from this project folder to the repo root (drag-drop in GitHub's web UI is fine).
5. Repo → **Settings → Pages** → Source: **Deploy from a branch**, branch: `main`, folder: `/ (root)`. Save.
6. Wait ~1 minute, then visit **https://atlbridgekids.github.io** — the site is live.

## 2 · Google Form: Event sign-ups

Create a new Google Form named "Atlanta Bridge Kids — Event sign-up". Add these fields (mark required as noted):

| Field | Type | Required |
|---|---|---|
| Which event? | Multiple choice or dropdown, one row per event | Yes |
| Participant name | Short answer | Yes |
| Age | Short answer (number) | Yes |
| Graduation year | Dropdown (2026 – 2040, add years as needed) | Yes |
| Parent name | Short answer | No |
| Email | Short answer | No |
| Phone | Short answer | No |
| Bridge level | Dropdown — leave blank/empty options for now | No |

In the Form's **Responses** tab, click the green Sheets icon → creates a Google Sheet in your Drive. This is your private signup database. Only you can see it.

Copy the Form's shareable link (the short `https://forms.gle/...` URL). This goes in `assets/site.js` under `signupFormUrl`.

## 3 · Google Form: Directory opt-in

Create a second form: "Atlanta Bridge Kids — Family directory". Fields:

| Field | Type | Required |
|---|---|---|
| Parent name | Short answer | Yes |
| Kid's first name | Short answer | Yes |
| Age | Short answer | No |
| Graduation year | Dropdown | Yes |
| School | Short answer | Yes |
| Email | Short answer | No |
| Phone | Short answer | No |
| **Share my info in the public directory?** | Multiple choice: **Yes** / **No** | Yes |
| Bridge level | Dropdown (leave empty for now) | No |

Link its responses to a Sheet the same way. Copy the shareable link → goes in `directoryFormUrl`.

## 4 · Google Sheet: publish aggregate counts

In the sign-ups Sheet, create a **new tab** called `counts_public`. Do NOT put names or emails here. Use `COUNTIF` formulas to build an aggregate view keyed by event ID:

Row 1 (header): `event_id, signed_up, grade_pk, grade_k, grade_1, grade_2, grade_3, grade_4, grade_5, grade_6, grade_7, grade_8, grade_9, grade_10, grade_11, grade_12`

For each event row, formulas like:
- `signed_up` = `=COUNTIF('Form Responses 1'!B:B, A2)` (where col B is "Which event?" and A2 is the event_id)
- `grade_5` = `=COUNTIFS('Form Responses 1'!B:B, A2, 'Form Responses 1'!F:F, "2033")` (grad year 2033 = 5th grade in fall 2026 — adjust col letter to your Graduation Year column)

You can simplify by making a helper column that converts graduation_year to grade, then COUNTIFS off that.

Then **File → Share → Publish to web** → pick the `counts_public` tab only → Comma-separated values (.csv) → Publish. Copy the URL.

Do the same for the directory Sheet: make a `directory_public` tab that filters `share = Yes` and shows only the fields you want public. Publish it as CSV.

## 5 · Wire it up

Open `assets/site.js`. Replace the top `CONFIG` block:

```js
const CONFIG = {
  eventsCsvUrl: "",    // Optional — if you keep events in a Sheet too
  countsCsvUrl: "PASTE_YOUR_COUNTS_CSV_URL_HERE",
  directoryCsvUrl: "PASTE_YOUR_DIRECTORY_CSV_URL_HERE",
  signupFormUrl: "PASTE_YOUR_SIGNUP_FORM_LINK_HERE",
  directoryFormUrl: "PASTE_YOUR_DIRECTORY_FORM_LINK_HERE"
};
```

Commit. The site now shows live counts.

## 6 · Managing events

Two options — pick one:

**Option A — Edit `events.json` in the repo.** Simplest. Each entry:
```json
{
  "id": "evt-2026-10-04-lesson",
  "title": "Saturday Youth Lesson",
  "type": "Lesson",
  "date": "2026-10-04",
  "start_time": "10:00",
  "end_time": "11:30",
  "location": "Duplicate Bridge Club of Atlanta",
  "grades": "3rd–8th",
  "description": "...",
  "signup_url": ""
}
```
Commit the change → live in seconds.

**Option B — Keep events in a Sheet tab too.** Publish that tab as CSV, put the URL in `eventsCsvUrl`. Then adding an event = a new sheet row, no commit.

Either way, the `id` must match the `event_id` you use in the counts tab so numbers line up.

## 7 · Donate

Edit `donate.html`. Replace the four `href="..."` placeholders with your actual Venmo, PayPal, Zelle instructions, and mailing address.

## 8 · Admin tool

Open `https://atlbridgekids.github.io/admin.html` when you want to review sign-ups. It's not linked from the public site. Paste in a CSV export from your Sheet (File → Download → CSV, or select+copy the range) → it flags duplicates and computes each kid's current grade from graduation year.

Bookmark the URL. Don't share it.

## 9 · Optional: custom domain

If later you want `atlbridgekids.org` instead of `.github.io`:
1. Buy the domain at any registrar ($10–15/yr).
2. Repo → Settings → Pages → Custom domain → enter it.
3. Add a CNAME record at your registrar pointing to `atlbridgekids.github.io`.
4. GitHub will provision HTTPS in a few minutes.

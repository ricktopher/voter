# voter
Observe what you vote to spend your time on. Get empirical measurements of your priorities.


# Feature lists

1. Calendar page : View distribution of where you input a decision.
2. Decision page : A page that gives you a LIST to pick a decision from.
    a. First filter by possible options.
    b. Pick what to do. Each pick is one raw decision, with no time span attached.

3. Modify decision page: 
    a. Add button : to add a potential option.
    b. Edit button : to modify a potential decision.
    c. Delete button : to delete a potential decision.
    d. Sort by button : Sort the decision list:
                            a. Alphabetically
                            b. Ascending by frequency made
                            c. Descending by frequency made

3. Priority matrix : Displays a heatmap of pairwise comparisons versus decisions. 
   Given two options or more options, which one you would rather pick.




# Features it SHOULD NOT have!

1. I don't want to be able to split it by projects. This is not how life works. 
   ALL of your projects / relationships / work etc. is competing for your priority.

# A note on recommended use:

1. Not all decisions should be tracked. Use only for decisions where you feel like
   something is off and you want to test it. This is an tool to create clarity. Not
   a tool to make you neurotic.


# Current state

- Static site: `index.html`, `styles.css` and the scripts in `js/`. No build step.
- Data is saved in the browser's localStorage (see `js/store.js`). It stays on that
  device only, so the phone and laptop don't share data automatically.
- To sync devices, use **Options → Back up & sync**. Export a JSON file on one device,
  then import it on the other with **Merge** (see `js/sync.js`). Merge never removes
  anything, so delete options on both devices, or use **Replace**.
- Hosted on GitHub Pages from the `prototype` branch: https://ricktopher.github.io/voter/
  Every push to `prototype` republishes the site within about a minute.


# Roadmap and hosting notes

Costs and free-tier limits below were noted in November 2026. Check them again before relying on them.

## 1. Make it an installable web app (PWA)

Add a web app manifest (name, icons, colours) and a service worker (offline caching).
The app then installs to the home screen with its own icon and opens full-screen.
Every route below, including the Play Store, starts from this.

## 2. Add a backend so devices share data

Only `js/store.js` needs to change: load from the backend on start and save to it on
every change, keeping localStorage as an offline copy. The rest of the app keeps using
the same `store` object.

**Option A: Supabase (quickest, free).** A hosted Postgres database with email
magic-link login, used straight from the static site, so GitHub Pages hosting stays as
it is. Start with one row per user holding the whole data as JSON, and protect it with
a Row Level Security rule so only you can read or write it. Free projects pause after
about a week without use.

**Option B: Django (more work, full control).** You write the login, API (e.g. Django
REST Framework), per-user access checks and account deletion yourself. Use **SQLite**:
it's one file on the server, costs nothing, and is plenty for this app. Backups mean
copying that file.

Django hosting, cheapest first:

| Option | Cost | Own domain | Notes |
|---|---|---|---|
| PythonAnywhere free tier | $0 | No (`<user>.pythonanywhere.com`) | Easiest. Limited CPU; you must click "extend" every 3 months. |
| PythonAnywhere entry paid plan | ~$5/month | Yes, with HTTPS | Same as free, without the limits. |
| Small VPS (e.g. Hetzner) | ~€4–5/month | Yes | Django + gunicorn + Caddy (automatic HTTPS). You handle updates and backups. |
| Oracle Cloud Always Free VPS | $0 | Yes | Same setup as a VPS. Sign-up can be fiddly; unused free machines can be taken back. |
| Render / Railway / Fly.io | $0 (sleeps or expires) to ~$5+/month | Yes | Free tiers sleep, cap usage or change terms. |

A custom domain costs about $10–15 a year, and is only needed for your own address or the Play Store.

**Suggested path for Django:** start on the PythonAnywhere free tier, with Django serving
both the site and the API (simplest login, no cross-domain setup). When you need your own
domain, upgrade to the paid plan or move to a VPS.

**Recommendation:** use Supabase now to get synced data on the phone quickly. If you
later move to Django, export the data from Supabase and import it there. Only
`js/store.js` changes in the frontend.

## 3. Publish on Google Play (later)

The store app is the same web app inside an Android wrapper. No rewrite is needed.

- **Wrapper:**
  - **Trusted Web Activity**, built with PWABuilder or Bubblewrap: a thin shell that
    opens the hosted site. Site updates reach the app without a new store release. It
    needs a custom domain, because `/.well-known/assetlinks.json` must sit at the domain
    root, which `ricktopher.github.io/voter/` can't provide.
  - **Capacitor:** copies the files into the app and gives access to native features
    such as reminder notifications. Each update needs a new store release. With Django,
    this means API-only mode, with CORS and token-based login.
- **Google Play requirements:** a one-time $25 developer account; a closed test with
  12+ testers for 14 days for new personal accounts; a privacy policy; the data safety
  form; in-app and web account deletion; and store listing assets (icon, feature
  graphic, screenshots, content rating).

## Rough cost summary

| Setup | Cost |
|---|---|
| Now: GitHub Pages + localStorage | $0 |
| GitHub Pages + Supabase | $0 |
| Django on PythonAnywhere free tier | $0 |
| Django with own domain (PythonAnywhere paid plan or VPS) | ~$5/month + ~$10–15/year domain |
| Google Play | + $25 once |
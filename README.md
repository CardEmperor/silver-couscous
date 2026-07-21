# PhD Dossier — Application Tracker

A single-page website for tracking your PhD applications. For every university + program you add, it keeps one "dossier" with:

- **Faculty** — professors with research areas and website links
- **Current PhD students** — with links to personal sites, Google Scholar, LinkedIn, or X
- **Application deadline** — with a live days-remaining countdown (turns red under 30 days)
- **Fees & fee waivers** — amount and waiver criteria
- **Selection profile** — past selection highlights and stated requirements (GPA, GRE policy, publications)
- **PhD placements** — where graduates land
- **Status tracking** — Researching → Preparing → Submitted → Interview → Admitted / Rejected
- **Notes** — your own comments per program

An optional **AI research** button uses the Anthropic API with web search to auto-fill all of the above from public web sources (department pages, Google Scholar, LinkedIn, X, personal sites), with source links. Everything is also editable by hand, so the site is fully usable without AI.

All data is saved in your browser's `localStorage` — no backend, no database, which is exactly what makes it hostable for free on GitHub Pages.

---

## Requirements

This is a JavaScript/Node project, so dependencies live in `package.json` (the Node equivalent of Python's `requirements.txt`). You need:

| Requirement | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org) | 18 or newer (20 recommended) | Build tooling |
| npm | comes with Node | Installs dependencies |
| An Anthropic API key | optional | Only for the AI research button |

Runtime dependencies: `react`, `react-dom`. Dev dependencies: `vite`, `@vitejs/plugin-react`. They install automatically with `npm install`.

---

## Project structure

```
phd-dossier/
├── .github/
│   └── workflows/
│       └── deploy.yml      # Auto-deploys to GitHub Pages on every push to main
├── src/
│   ├── App.jsx             # The entire application (UI + storage + AI research)
│   └── main.jsx            # React entry point
├── index.html              # HTML shell + font loading
├── package.json            # Dependencies and scripts ("requirements" file)
├── vite.config.js          # Build config (relative base path for Pages)
├── .gitignore
└── README.md
```

---

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

To create a production build: `npm run build` (output goes to `dist/`, preview it with `npm run preview`).

---

## Deploy to GitHub Pages (automatic)

1. **Create a new GitHub repository** (public, or private on a paid plan — Pages on free accounts requires a public repo).

2. **Push this folder to it:**

   ```bash
   git init
   git add .
   git commit -m "PhD Dossier application tracker"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

3. **Enable Pages:** in the repository go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

4. Done. The included workflow (`.github/workflows/deploy.yml`) builds the site and publishes it on every push to `main`. After the first run finishes (check the **Actions** tab), your site is live at:

   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO/
   ```

No configuration changes are needed for the repo name — `vite.config.js` uses a relative base path (`base: "./"`), so the build works at any URL.

---

## Setting up AI research (optional)

1. Get an API key at [console.anthropic.com](https://console.anthropic.com) → **API keys**. API usage is pay-as-you-go; each research run makes one Claude call with a handful of web searches (typically a few cents).
2. Open your deployed site, click **○ Set API key** in the header, paste the key, and save.
3. The key is stored **only in your own browser's localStorage** and is sent **only to `api.anthropic.com`**. It is never committed to the repo or sent to GitHub.

Without a key, every feature still works — you just fill the fields in manually with the **Edit** buttons.

### Security notes — please read

- **Never hardcode your API key** into `App.jsx` or any committed file. Anyone viewing your public repo or the site's source could copy it and spend your credits. The in-app key panel exists precisely so the key stays out of the code.
- This app calls the Anthropic API directly from the browser (using Anthropic's CORS support). That is fine for a **personal** tool where you paste your own key into your own browser. If you ever want a shared/public version where visitors don't bring their own key, put the API call behind a tiny serverless proxy (Cloudflare Workers, Vercel functions) instead — do not ship a shared key to the client.
- Consider setting a **monthly spend limit** on your Anthropic account as a safety net.

---

## Data & limitations

- Programs, notes, and your API key live in the browser's `localStorage`. Clearing site data deletes them, and data does not sync between devices/browsers. (Back up by copying important details elsewhere before clearing your browser.)
- AI research pulls only **publicly indexed** pages. Login-gated social profiles (private LinkedIn/X accounts) may not surface.
- AI results can be incomplete or outdated — **always verify deadlines, fees, and waiver rules on the official admissions page** before relying on them. Each research run lists its sources at the bottom of the dossier.

---

## Customizing

- **Colors and fonts** — edit the constants at the top of `src/App.jsx` and the font `<link>` in `index.html`.
- **Statuses** — edit the `STATUSES` array in `src/App.jsx`.
- **Research depth** — edit the prompt inside `researchWithAI()` in `src/App.jsx` (e.g., ask for more professors, funding info, or specific labs) and raise `max_tokens` if you request more.

## Troubleshooting

| Problem | Fix |
|---|---|
| Actions tab shows a failed deploy | Ensure **Settings → Pages → Source** is set to **GitHub Actions**, then re-run the workflow. |
| Blank page after deploy | Hard-refresh (Ctrl/Cmd+Shift+R). Confirm `vite.config.js` still has `base: "./"`. |
| "Research failed (401/authentication…)" | The API key is wrong or revoked — re-enter it via **Set API key**. |
| "Research failed (429…)" | Rate limit or out of credits on your Anthropic account. |
| Data disappeared | localStorage was cleared or you're in a different browser/private window. |

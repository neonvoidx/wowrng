# WoW Spec Randomizer

Randomly assigns World of Warcraft specializations to a five-player group — one **Tank**, one **Healer**, three **DPS** — with spec icons and a dark-fantasy theme.

Built with TypeScript + Vite. Static output, hosted on GitHub Pages.

## Features

- Enter up to 5 player names (blank names become "Player N")
- Every group gets exactly 1 Tank, 1 Healer, 3 DPS, assigned to random players
- Spec icons + official class colors on every result card
- Toggleable rules:
  - **No duplicate specializations** (on by default) — no two players get the same class/spec
  - **No duplicate classes** (off by default) — every player gets a different class
  - **Must include bloodlust** (on by default) — at least one player draws a lust-capable spec
  - **Set melee / ranged DPS amount** (off by default) — require at least N melee
    or ranged DPS via slider (0–3). With both active, each slider is capped by the
    other's remaining budget so the combined total never exceeds 3.
  - **Must include bloodlust** — at least one player draws a lust-capable spec
    (all Mage / Shaman / Evoker specs via Time Warp, Bloodlust/Heroism, Fury of the Aspects,
    and all Hunter specs via their pet's Primal Rage)
- Data lives in [`public/specs.json`](public/specs.json) — retail specs (Midnight era), roles, bloodlust flags, icon names

## Development

```bash
yarn install
yarn dev       # dev server
yarn build     # typecheck + production build to dist/
yarn preview   # serve the production build locally
```

### Icons

`public/icons/` contains all spec icons downloaded from Blizzard's CDN
(filenames mapped in `specs.json`). To re-download or refresh them:

```bash
yarn fetch-icons          # skips files that already exist
yarn fetch-icons --force  # re-download everything
```

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and deploys on every push to `main`.

The Vite `base` path is derived from the repository name automatically in CI, so project pages
(`https://<user>.github.io/<repo>/`) work out of the box.

## Customizing

Edit `public/specs.json` to add/rename specs (e.g. when a patch ships a new specialization),
flip `bloodlust` flags, or adjust roles — no code changes needed. If you add a new entry,
set `icon` to any unique slug and `blizzIcon` to Blizzard's icon filename, then run
`yarn fetch-icons`.

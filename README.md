# WoW Spec Randomizer

Randomly assigns World of Warcraft specializations to a five-player group — one **Tank**, one **Healer**, three **DPS** — with spec icons and a dark-fantasy theme.

Built with TypeScript + Vite. Static output, hosted on GitHub Pages.

## Features

- Enter up to 5 player names (blank names become "Player N")
- **One trick pony** (off by default): tick OTP next to a player and pick their
  spec — that player is always assigned it, overriding "Limit specializations"
  for them. Composition relaxes if pins overfill a role (extra tanks steal DPS
  slots), and rules are still followed everywhere else they apply; unsatisfiable
  ones degrade gracefully instead of erroring. Mutually exclusive with the
  per-player "Exclude certain specs" toggle below (checking either disables the other)
- **Exclude certain specs** (off by default): tick next to a player and select
  the specs they must never receive — even via rule swap-ins like bloodlust or
  battle rez replacements. The selection opens in an expandable list (collapsible
  afterwards) showing a live count; mirrored into shareable links
- Every group gets exactly 1 Tank, 1 Healer, 3 DPS, assigned to random players
- Spec icons + official class colors on every result card
- **Shareable links**: rules, player names, spec limits and the last generated
  group are mirrored into the URL query string as you change them; opening such
  a link restores everything and replays the exact same group (seeded PRNG).
  Changing any control afterwards drops the stale seed until you regenerate.
- Each card lists what that player **brings** (with icons): their exact bloodlust
  spell (Time Warp for mages, Fury of the Aspects for evokers, Primal Rage for
  hunters, Bloodlust for shamans), their exact battle rez (Rebirth for druids,
  Raise Ally for death knights), their class raid buff (per Midnight 12.x —
  Chaos Brand, Arcane Intellect, Hunter's Mark, Skyfury, …), and notable utility
  (Death Grip; Demonic Gateway + Soulstone for the buff-less classes). Every
  Brings entry links to its Wowhead spell page and shows an official Wowhead
  tooltip on hover (via the zamimg widgets script; degrades gracefully offline)
- Toggleable rules:
  - **No duplicate specializations** (on by default) — no two players get the same class/spec
  - **No duplicate classes** (off by default) — every player gets a different class
  - **Must include bloodlust** (on by default) — at least one player draws a lust-capable spec
  - **Limit to 1 augmentation evoker at most** (on by default) — reroll extra Augmentation
    evokers; never forces one into the group
  - **Must have battle rez** (on by default) — at least one Death Knight or Druid spec,
    the only classes that can resurrect allies in combat
  - **Limit specializations** (off by default) — pick which specs may appear; unticked
    specs are excluded from generation
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

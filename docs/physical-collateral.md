# Physical Collateral

Physical and strategic artifacts for PULSE (bracelets, poster, NFC cards,
expo stand, decks, strategy docs) live **outside this repo**, in a sibling
folder: `pulse-collateral/`.

```
~/code/
  Pulse/                  ← this repo (app source)
  pulse-collateral/       ← physical + strategic work
```

---

## Why it's separate

Collateral never touches the build pipeline. It isn't compiled, imported,
deployed by GitHub Actions, or synced by `npx cap sync`. Keeping it out
of the repo keeps the repo focused on what ships to production.

## What's in the collateral folder

- **`bracelets/`** — paper admit bands for the SCAD senior studio show. Current design: `bracelets/current-v8/`.
- **`business-cards/`** — NFC-embedded cards (not started).
- **`poster/`** — stand wall poster with NFC tap-zone (not started).
- **`expo-stand/`** — physical setup spec for the SCAD show (not started).
- **`decks/`** — pitch decks, demo scripts (not started).
- **`strategy/`** — competitive wedge doc, positioning, GTM (not started).

## When to read the collateral folder

Claude Code generally doesn't need to. The two exceptions:

1. **Bracelet admit flow.** The app's admit flow needs to match bracelet IDs
   (PULSE-01 through PULSE-20). The bracelet design spec documents what
   format the QR payloads take and what band numbers exist. See
   `pulse-collateral/bracelets/current-v8/DESIGN-SPEC.md` if building
   or modifying the admit-and-scan flow.
2. **Expo stand wiring.** If building the broadcast flow that sends
   admitted patients to the 55" touchscreen, the expo stand doc
   (`pulse-collateral/expo-stand/README.md`) describes the hardware setup.

## If the collateral folder moves

Update the path reference above. This pointer file is the one place the
repo acknowledges the collateral folder exists, so it's the only thing
that needs updating if you reorganize.

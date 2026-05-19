# REVERT POINT — multi-device rebuild

Created 2026-05-18, before the four-screen (iPhone / iPad / iMac 24" /
55" touch) layout rebuild. This is the "undo button."

## The safe state

Everything from the #2–#11 session is shipped and working at:

- **Tag:** `safe-pre-multidevice`
- **Commit:** `720e40f`
- Pushed to GitHub, so it survives even if this machine is lost.

Every commit for the multi-device rebuild comes AFTER this tag and its
message starts with **`multidevice:`** so the whole effort is easy to
spot in `git log`.

## How to revert (pick one)

### Option 1 — Undo EVERYTHING, safely (recommended)

Puts the app back exactly to the working version from the tag and
re-deploys the good version to the live site + devices (~1 min). No
history is destroyed; it adds "undo" commits.

```
cd /Users/nickrapoport/Documents/PULSE
git revert --no-edit safe-pre-multidevice..HEAD
git push origin main
```

Then redeploy the device builds with the normal ship loop
(`npm run build` → `npx cap sync ios` → the iPhone/iPad rebuild).

### Option 2 — Undo ONE bad step

If only the latest change broke something, undo just that one:

```
git revert --no-edit HEAD
git push origin main
```

### Option 3 — Hard reset (nuclear, ask first)

`git reset --hard safe-pre-multidevice` then a force-push. This DELETES
the multi-device history. Destructive and a force-push to main —
**only do this on Nick's explicit say-so**, never automatically.

## Plain-language summary

Running Option 1 means: the live site and the devices go back to
exactly the working demo you have now, within about a minute, and
nothing is lost — we can always re-apply the rebuild later. Use it the
moment anything looks wrong and we'll sort it out from a known-good
base.

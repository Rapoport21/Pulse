# REVERT POINT — multi-device rebuild

Created 2026-05-18, before the four-screen (iPhone / iPad / iMac 24" /
55" touch) layout rebuild. This is the "undo button."

## ⚠️ STATUS: ON PROBATION (as of 2026-05-18)

Nick is living with the rebuild for a few days and **may ask to revert
it**. If a future session sees Nick say anything like "revert it",
"undo the multi-device thing", "go back to before the rebuild" — DO
THIS IMMEDIATELY using the steps below. No need to re-investigate; the
decision is pre-made and the exact commits are listed here. Until Nick
explicitly says he's KEEPING it, do not assume the rebuild is
permanent, and avoid stacking large unrelated work on top of the
`multidevice:` commits (it makes a clean revert harder).

**The exact rebuild commits (newest → oldest), for a surgical revert
that works even if unrelated commits land afterward:**

```
88c243a  multidevice: QA polish — clinical tap targets + PulseAI 55" width
d465b6c  multidevice: touch-target floor on coarse-pointer devices (step 3)
803b2e3  multidevice: stack the Staffing 3-pane body on the iPad band (2b)
6e90e7a  multidevice: off-canvas command sidebar on the iPad band (2a)
4ff88d8  multidevice: large-format scaling for the 55" wall (step 1)
```

Surgical revert (preferred if other work landed after):
```
cd /Users/nickrapoport/Documents/PULSE
git revert --no-edit 88c243a d465b6c 803b2e3 6e90e7a 4ff88d8
git push origin main
```
Then redeploy: `npm run build` → `npx cap sync ios` → iPhone rebuild.
(The two docs commits 2815a2c / dc063fa are harmless; revert them too
only if you want the docs back to pre-rebuild — usually leave them.)

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

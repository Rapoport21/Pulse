# PULSE — Zag 17-Step Answers

The 17-step process from *Zag* by Marty Neumeier (pp. 138–143), applied to PULSE.
Every claim below is grounded in `docs/project-brief.md`, `docs/vision.md`,
`metadata.json`, or `CLAUDE.md`. Items that aren't in those docs are flagged
as unverified.

---

## 1. Who are you?
*Sub-questions: Where do you have the most credibility? Where do you have the most experience? Where does your passion lie?*

- **Passion (documented):** tactical-HUD design discipline, hospital ED operations, AI-augmented forecasting, single-platform unification. Build partner is Nick Rapoport with Claude Code.
- **Credibility / experience in healthcare:** *not documented.* Clinical advisors, ED design partners, and procurement contacts — if they exist — aren't mentioned in `docs/`. **Unconfirmed — flag for the obituary exercise.**

## 2. What do you do? (≤12 words)
- Documented (`metadata.json`): *"Patient Urgency & Load Situational Engine — A mission-control dashboard for hospital operations."*
- Tightened for the checkpoint: **"Run hospital operations and forecast 90-minute surge risk on one tactical console."**

## 3. What's your vision?
From `docs/vision.md`: every hospital using PULSE as the everyday system (EHR, bed management, staffing, comms, diagnostics) that *also* forecasts the next 90 minutes of risk, proposes coordinated surge plans across departments, and routes them through Operations Director confirmation. Documented demo cycle:

1. Normal operations
2. Risk emerges on the 90-minute horizon
3. PULSE proposes a surge action with driver decomposition
4. Operations Director confirms (human-in-the-loop)
5. Distributed task execution; risk drops
6. Back to normal — proving PULSE is the everyday system, not just a crisis tool

## 4. What wave are you riding?
Trends visible in the project (some documented, some implied):

- AI-augmented operations with human-in-the-loop confirmation (explicit in `vision.md`)
- Tactical-HUD UI patterns crossing from defense (Palantir Gotham, Anduril Lattice — both named in `project-brief.md`) into healthcare
- Predictive / forward-looking ops vs. reactive dashboards
- Hospital staffing shortages and ED boarding pressure (implied by surge-action focus)
- Consolidation of fragmented hospital software into a single shell
- Mobile-first clinical tooling (iOS-first via Capacitor)

## 5. Who shares the brandscape?
Documented in `vision.md`: Epic, Cerner, TeleTracking are named as systems PULSE can integrate with or shell around. Other obvious adjacencies (Qventus, LeanTaaS, Hospital IQ, Care Logistics) **are not in the docs and would need confirmation before being treated as competitors.** A new-category play is plausible — "tactical HUD for ED ops" doesn't have an obvious incumbent.

## 6. What makes you the "only"?
- **WHAT** — the only hospital operations console
- **HOW** — that pairs day-to-day ops with a 90-minute forward risk forecast and human-in-the-loop surge actions
- **WHO** — for ED Operations Directors, Charge Nurses, and Trauma Attendings
- **WHERE** — in U.S. hospital emergency departments (current scope per the docs)
- **WHY** — who need one system that handles normal ops *and* coordinates surges across departments
- **WHEN** — in an era of staffing shortages, ED boarding, and AI-augmented operations

## 7. What should you add or subtract?
Already pre-sacrificed (per `project-brief.md`): rounded cards, pastel palettes, heavy shadows, playful copy, "one view for all roles." Pre-sacrificed scope (per `vision.md`): full compliance build (CMS quality measures, HIPAA audit trails, FHIR integration) is deferred to `docs/production-scope.md`.

The discipline to watch: don't drift toward charting parity with Epic. The surge-forecast + human-in-the-loop layer is the zag — anything that pulls dev hours away from it, sacrifice.

## 8. Who loves you? (ecosystem)
- **Inside:** Nick + Claude Code (build partner)
- **Demo audience (documented):** primary — UX and industry professionals; secondary — hospital execs (CMO/COO/CNO) and clinicians (ER directors, charge nurses)
- **Distribution audience (documented):** SCAD / investor / procurement stand visitors who need the live, reset-able sim in 10 seconds
- **Future ecosystem (implied, not documented):** clinical advisors, integration partners (Epic/Cerner/TeleTracking), implementation partners. **None of those partners are documented yet — flag.**

## 9. Who's the enemy?
Candidates from the documented positioning:

- **Fragmented hospital software** — the EHR + separate bed board + separate staffing tool + separate alerts pager pattern that forces operators to triangulate across screens.
- **Reactive operations** — waiting until a surge hits vs. seeing the next 90 minutes.
- **Text-heavy enterprise healthcare UX** — the implicit foil for the tactical HUD aesthetic.

`project-brief.md` describes PULSE as *"Palantir Gotham / Anduril Lattice, but for the ED charge nurse,"* which sets up "the legacy hospital console" as the natural enemy.

## 10. What do they call you?
**PULSE** (Patient Urgency & Load Situational Engine).

- Different: evocative (heart pulse, vital sign, ops pulse)
- Brief: 5 letters, 1 syllable
- Appropriate: fits the healthcare + ops domain
- Easy to spell/pronounce: yes
- **Legal defensibility: weak.** "PULSE" is heavily used as a product/company name across software, security, and energy. Trademark availability for "PULSE" in healthcare-software class is **not documented and would need a clearance search before going to market.**
- URL: github.com/Rapoport21/Pulse and rapoport21.github.io/Pulse/ are documented. **A standalone product domain is not documented.**

## 11. How do you explain yourself? (trueline → tagline)
- **Trueline:** *PULSE turns the next 90 minutes of hospital risk into coordinated action.* (No commas. No "ands.")
- **Tagline candidates:**
  - "PULSE. The next 90 minutes."
  - "See it before it hits."
  - "Hospital command. One surface."

## 12. How do you spread the word?
Documented touchpoints: the live demo stand (SCAD / investor / procurement), the GitHub Pages web preview, the iOS Capacitor build on simulator/device, the GitHub repo README. Per the Zag checkpoint: over-invest in the demo experience (one voice across stand visuals, the sim, the iOS bundle, the README banner) and under-invest in channels where PULSE would be one of many — paid hospital trade media, generic SaaS marketing.

## 13. How do people engage with you?
Documented engagement model: *"a fresh visitor needs to see a live, reset-able simulation in 10 seconds."* Realtime cross-device sync via `lib/realtime.ts` (BroadcastChannel + LWW tiebreak) lets a presenter drive one device while the audience watches on another. Each role surface (Manager / Nurse / ER / Trauma) is the engagement entry point — pick a lens, see the same data through it.

White space the docs already claim: nobody else is shipping ED ops as a tactical HUD with a reset-able sim demo.

## 14. What do they experience?
Customer journey, drawn from `vision.md` demo cycle:

- 0–10s — pick up the device, see the HUD render
- 10–30s — pick a role surface; watch the normal-ops state
- 30–90s — risk emerges on the 90-minute horizon, driver decomposition explains *why*
- 90–120s — PULSE proposes a coordinated surge plan; Operations Director confirms
- 120–180s — tasks distributed across departments execute, risk drops
- 180s+ — Brief Me (30-second handoff) and Replay (scrubbable timeline) demonstrate after-the-fact value

Touchpoints to over-fund: the 90-minute forecast tile, the driver-decomposition "why" view, the surge-action confirmation, Brief Me, Replay. Touchpoints to drop: anything that asks the visitor to read documentation before they see the sim move.

## 15. How do you earn their loyalty?
**Not documented yet — PULSE is pre-deployment.** Forward-looking framing: avoid the procurement-lock "disloyalty program" pattern (multi-year contracts that hold customers in via switching cost). The PULSE-shaped answer is loyalty earned via the Replay / after-action loop — every shift handoff and every surge event makes the institution smarter, so the system gets *more* valuable the longer a hospital uses it.

## 16. How do you extend your success?
Branded-house vs. house-of-brands: PULSE is structurally a **branded house** — every module sits under the PULSE shell (EHR tab, BedBoard, AdmitFlow, AlertsCenter, WorkforceCoverage, PatientsPage, Brief Me, Replay all live in the same app).

Documented extension paths: from ED to whole-hospital; from US to other healthcare regimes; from shell-around-Epic to full replacement.

Risk: stretching to "all hospital software" can erode the sticky meaning ("the next-90-minutes surge console") that makes the zag work.

## 17. How do you protect your portfolio? (the 4 C's)
- **Contagion** — one bad hospital incident under the PULSE name could damage the whole brand. Firewalls between deployment environments and a clear escalation playbook matter early.
- **Confusion** — biggest risk. If PULSE adds enough modules to look like "another hospital ops platform," the 90-minute forecast + human-in-the-loop story gets diluted. Stickiness is in the surge layer, not in EHR-charting parity.
- **Contradiction** — international expansion runs into very different healthcare regimes. The vision doc only specifies US ED scope today, which is the right call.
- **Complexity** — the documented discipline is "compliance-lite, visually complete." That's the right answer for now: prune `production-scope.md` items into a documented backlog rather than building them into the demo. The all-in-one vision needs `say no` discipline as it grows.

---

## Open items to nail down

1. Healthcare credibility / clinical advisors (Q1)
2. Specific named competitors beyond Epic / Cerner / TeleTracking (Q5)
3. Trademark clearance on the PULSE name (Q10)
4. Standalone product domain (Q10)
5. Loyalty / retention model (Q15)

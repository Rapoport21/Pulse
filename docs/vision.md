# PULSE — Product Vision

> **PULSE** — Patient Urgency & Load Situational Engine

## What PULSE Is

PULSE is an **all-in-one hospital platform** that unifies every software
surface a hospital needs — operations, clinical workflow, bed management,
staffing, communication, and diagnostics — into a single system with a
consistent, modern UI and built-in AI capabilities.

It supports **day-to-day hospital management** while also **forecasting
near-term risk for the next 90 minutes** and converting it into
coordinated action. When risk rises, PULSE proposes **surge actions** —
plans that distribute owned tasks across departments (bed management,
staffing, EVS/transport, diagnostics) — and requires confirmation from
the Operations Director before executing.

## Core Differentiators

1. **90-Minute Forward Risk Forecast** — a shared operational picture of
   capacity and constraints (beds as states: ready, not ready, not
   staffed, blocked; workforce as coverage gaps, not headcount).

2. **Explainable "Why" View** — every risk metric has a driver
   decomposition so operators understand what's pushing the number and
   trust the system's assessment.

3. **Surge Actions with Human-in-the-Loop** — PULSE detects threshold
   crossings, proposes a coordinated plan, and routes it to the
   Operations Director for confirmation. Once confirmed, tasks are
   assigned to owners across departments with ETAs and tracked to
   completion.

4. **Confidence & Freshness Indicators** — every data tile carries
   age-of-data and confidence signals. Stale data dims. Partial data
   triggers Manual Mode with graceful degradation.

5. **Brief Me** — a 30-second AI-synthesized shift handoff that
   preserves continuity across shift changes.

6. **Replay** — a scrubbable timeline of decisions, actions, and
   outcomes for after-action review and continuous learning.

7. **Role-Aware Surfaces** — the same underlying data rendered through
   different lenses for Manager (Operations Director), Nurse (Charge
   Nurse), and ER Personnel (Trauma Attending).

## How PULSE Relates to Existing Systems

PULSE can integrate with existing hospital systems (Epic, Cerner,
TeleTracking, etc.) on the backend, providing a better, more consistent
UI with AI features and clarity on top of existing data feeds. Whether
PULSE operates as a shell around the EHR or replaces it entirely is an
implementation decision — what matters is that the user sees and
interacts with **one platform** for all their hospital software needs.

The EHR workflow (charting, orders, medications, labs, documentation) is
included inside PULSE as a dedicated tab. Clinicians see familiar
workflows rendered in PULSE's design language alongside the novel
operations and forecasting features.

## Design Philosophy

- **Tactical HUD aesthetic** — Palantir/Anduril-inspired command surface
  with Geist + Geist Mono typography, near-black canvas, corner
  brackets, monospace data labels, rose-600 accent reserved for urgency.
- **Compliance-lite, visually complete** — every screen meets the design
  bar and presents a complete, polished experience. Backend compliance
  (CMS quality measures, HIPAA audit trails, FHIR integration specs) is
  documented in `docs/production-scope.md` but not implemented in the
  proof of concept.
- **Density when it serves the workflow** — command surfaces are dense;
  patient-facing views breathe. No forced density for its own sake.
- **Animations are both tactical and aesthetic** — transitions
  communicate state changes AND make the system feel alive. This is a
  concept that must look compelling.

## Demo Audience

Primary: **UX and industry professionals** evaluating the design and
interaction model. Secondary: hospital executives (CMO/COO/CNO) and
clinicians (ER directors, charge nurses).

## Demo Cycle

The demo follows a full operational cycle:

1. **Normal operations** — PULSE handling day-to-day hospital activity
   (EHR, bed management, patient tracking, clinical workflow)
2. **Risk emerges** — capacity forecast shows rising saturation
3. **PULSE proposes surge action** — driver breakdown, coordinated plan
4. **Operations Director confirms** — human-in-the-loop approval
5. **Tasks execute** — distributed across departments, tracked in
   real-time, risk drops
6. **Back to normal** — demonstrating PULSE is the everyday system, not
   just a crisis tool

## What Production PULSE Would Also Include

See `docs/production-scope.md` for the full list of compliance,
regulatory, and backend concerns that a production deployment would
address — documented but not built in the proof of concept.

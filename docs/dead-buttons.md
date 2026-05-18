# PULSE — Dead Button Inventory

Backlog #10 deliverable. A complete inventory of buttons / clickable
rows whose handlers are non-functional (empty, toast-only stub,
log-only, TODO placeholder, or clickable-with-no-handler).

**This document is the deliverable, not a fix.** Wiring these up is a
separate future epic. Created 2026-05-18 from a systematic sweep of
`components/` + `App.tsx` (excludes `marketing/`, `marketing-v2/`).

**Summary: 47 dead buttons across 11 surfaces.** Most are "toast-only
stubs" (Rule 2): the click fires a confirmation toast but performs no
real state change, navigation, or workflow.

Classification rules used:
1. Empty handler. 2. Toast-only stub. 3. Log-only. 4. TODO/FIXME
placeholder. 5. Clickable element with no handler where an action is
implied.

---

## ⚠️ Flag: 2 stubs survived the 2026-05-14 Horizon fix

The sprint 2026-05-14 pass fixed the Horizon Command Actions grid, but
two severity-branch CTAs were missed and are **still toast-only**:

- `components/PulseHorizon.tsx:1064` — **Schedule Discharges** (sev 0/1
  branch) — toast `'Discharge sweep requested · porters paged'`.
  **Should:** trigger a discharge sweep / page porters for real.
- `components/PulseHorizon.tsx:1082` — **Request Float Pool** (sev 2
  branch) — toast `'Float pool requested · ETA 20m'`.
  **Should:** submit a real float-pool staffing request.

The Command Actions grid (1641-1653) and the sev-3 / first-login
"Activate Surge Playbook" path are correctly wired; only these two
remain.

---

## By surface

### components/PatientDetailScreen.tsx
Every stub ships twice (embedded path ~383-1429, full-screen overlay
~1431+). The 14 entries collapse to ~7 logical buttons; a fix must
touch both paths.

| Line | Button | Should do |
|---|---|---|
| 785 / 1876 | Add Intake | Open intake-volume dialog, persist to I/O |
| 794 / 1885 | Add Output | Open output-volume dialog, persist to I/O |
| 855 / 1946 | Add (Allergies) | Open add-allergy form, append to `clinical.allergies` |
| 905 / 1996 | Scan to Admin (MAR) | Launch barcode scanner for med admin |
| 930 / 2021 | Administer (Morphine) | Record administration on the MAR |
| 959 / 2050 | Admin (per-med row) | Mark that med given on the MAR |
| 1128 / 2227 | Read Full Note | Open full clinical-note detail view |

### components/MobilePatientDetailScreen.tsx
`onOpenVitals` is never passed at the call site (MobileView.tsx
~5562-5580), so both Vitals CTAs fall through to a stub.

| Line | Button | Should do |
|---|---|---|
| 1299 | Record Vitals (empty state) | Open vitals capture (wire `onOpenVitals`) |
| 1319 | Record New Vitals | Open vitals capture (wire `onOpenVitals`) |
| 1486 | Note row (`role=button`) | Open the selected clinical note |
| 1565 | Order row (`role=button`) | Open the selected order detail |

### components/MobileView.tsx
| Line | Button | Should do |
|---|---|---|
| 1972 | Performance Metrics card | Navigate to the KPI cockpit screen |
| 5264 | Quick Page tile (CHARGE/PHARM/BLOOD/SEC) | Actually page the selected role |
| 5309 | Broadcast Emergency | Trigger a real hospital-wide broadcast |

### components/MobileLiveOps.tsx
| Line | Button | Should do |
|---|---|---|
| 435 | Patients (zone) | Open patient list filtered to the zone |
| 444 | Staff (zone) | Submit a staffing request for the zone |
| 453 | Escalate (zone) | Trigger the zone escalation workflow |

### components/clinical/DeptCoordination.tsx
| Line | Button | Should do |
|---|---|---|
| 343 | Message (dept) | Open a comms thread to the department |
| 352 | Patients (dept) | Open the department's patient list |
| 361 | Escalate (dept) | Trigger department escalation |
| 838 | {alert.action} | Execute the alert's stated action |
| 918 | Send Coordination Message | Compose + post a coordination message |

### components/clinical/RoundingList.tsx
("Add Note" at :804 is **not** dead — real `onAddNote`.)

| Line | Button | Should do |
|---|---|---|
| 796 | Chart | Open the patient's chart/detail |
| 822 | Orders | Open order entry for the patient |
| 831 | Rapid Response | Trigger rapid-response activation |

### components/clinical/AlertsCenter.tsx
(Acknowledge / Resolve / Escalate are real mutations — not dead.)

| Line | Button | Should do |
|---|---|---|
| 1421 | {action} (per-alert context action) | Execute the named contextual action |

### components/clinical/WorkforceCoverage.tsx
(REQUEST / message / support / call-in handlers are real — `appendChange`.)

| Line | Button | Should do |
|---|---|---|
| 688 | HANDOFF (mobile) | Open the handoff checklist/composer |
| 1192 | HANDOFF (desktop) | Open the handoff composer |

### components/clinical/SecureMessaging.tsx
Indirect stubs via named handlers (`handlePage` :352, `handleSharePatient`
:357, `handlePageOnCall` :362) — each just needs its body implemented.

| Line | Button | Should do |
|---|---|---|
| 457 | Page On-Call | Initiate an on-call attending page |
| 460 | Share Patient | Attach/share a patient link into the channel |
| 679 | PAGE | Send a page to the active channel |

### components/clinical/BriefMeScreen.tsx
| Line | Button | Should do |
|---|---|---|
| 281 | Chart chevron row | Open that patient's chart |
| 242 | Act (priority action, `handleAct` :132) | Execute the priority action |

### components/clinical/HandoffComposer.tsx
| Line | Button | Should do |
|---|---|---|
| 356 | Print (`handlePrint` :168) | Open a real print dialog / printable handoff |

---

## Systemic patterns (for the fix epic)

- **Duplicated stub sets.** `PatientDetailScreen` ships every stub
  twice (embedded vs overlay); `WorkforceCoverage` HANDOFF is mobile +
  desktop. Fix both paths together.
- **"Quick action" trios dominate.** Zone/department action rows
  (MobileLiveOps Patients/Staff/Escalate, DeptCoordination
  Message/Patients/Escalate), RoundingList Chart/Orders/RapidResponse,
  and the PatientDetail Add-Intake/Output/Allergy/Scan group are
  systematically acknowledge-only toasts standing in for cross-surface
  navigation or workflow launches. Many can share a "navigate to X
  filtered by Y" primitive.
- **Indirect stubs via named handlers** (SecureMessaging, BriefMeScreen
  `handleAct`, HandoffComposer `handlePrint`) are functionally
  identical to inline toast stubs — group them in the epic; each just
  needs its handler body.
- **Deeper data-layer gap (not counted as dead):** the LiveOps
  `StaffManagementModal` / `PrintPreviewModal` callbacks invoke a real
  chain but the parent's persistence is a toast. That is a state-layer
  task, not a dead button — note it for the epic separately.

## Verified NOT dead (scope boundary for the epic)
WorkforceCoverage REQUEST/message/support, RoundingList "Add Note",
CodeBlueScreen event log, AlertsCenter Ack/Resolve/Escalate, AdmitFlow
"Admit" (new this session), all `App.tsx` buttons.

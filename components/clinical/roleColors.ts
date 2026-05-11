/**
 * Clinical role + department color palette — tokenized.
 *
 * Replaces ad-hoc Tailwind violet / sky leaks that snuck into the
 * clinical layer (RN/LPN/RT roles, Pharmacy/Radiology departments,
 * the Staffing tab indicator). Every entry maps to a brand-tinted
 * variant of an existing semantic token in components/design/tokens.ts
 * so the palette reads as PULSE (dark + rose-accented) instead of
 * generic SaaS-purple.
 *
 * Rules:
 *   - One role/department -> one canonical color
 *   - Color always derived from COLORS.ok/info/warn/crit + accent
 *   - Staffing / workforce surfaces share a single "staffing" tone
 *     so the Workforce panel reads as one system
 *
 * Audit reference: 2026-05-10 audit flagged #8B5CF6 (violet-600) and
 * #06B6D4 (sky-500) as off-brand AI tells. This module is the fix.
 */

import { COLORS } from '../design';

// ─────────────────────────────────────────────────────────────────
// Roles — nursing / clinical staff
// ─────────────────────────────────────────────────────────────────
// RN  — primary nursing role          → accent (signature brand)
// LPN — auxiliary nursing role         → accentDeep (muted brand)
// RT  — respiratory therapist          → info (blue)
// MD  — physician                      → ok (green, "advanced care available")
// CHARGE — charge nurse                → warn (amber, attention/lead)
// TECH — technician                    → textSecondary (utility)
export const ROLE_COLORS: Record<string, string> = {
  RN:     COLORS.accent,        // #E11D48
  LPN:    COLORS.accentDeep,    // #9F1239
  RT:     COLORS.info,          // #3B82F6
  MD:     COLORS.ok,            // #10B981
  CHARGE: COLORS.warn,          // #F59E0B
  TECH:   COLORS.textSecondary, // #A3A3A3
};

// ─────────────────────────────────────────────────────────────────
// Departments — for census, transfers, dept coordination grid
// ─────────────────────────────────────────────────────────────────
// ED      — emergency department    → accent (the surface PULSE owns)
// ICU     — intensive care            → crit (life-critical)
// MEDSURG — med-surg floors           → ok (general care)
// L&D     — labor & delivery          → accentBright (rose-bright)
// PEDS    — pediatrics                → info (blue)
// PSYCH   — psychiatric                → warn (amber)
// RAD     — radiology utility         → textSecondary (utility)
// RX      — pharmacy utility          → accentDeep (muted brand)
// LAB     — lab utility               → ok
export const DEPT_COLORS: Record<string, string> = {
  ED:      COLORS.accent,
  ICU:     COLORS.crit,
  MEDSURG: COLORS.ok,
  'L&D':   COLORS.accentBright,
  PEDS:    COLORS.info,
  PSYCH:   COLORS.warn,
  RAD:     COLORS.textSecondary,
  RX:      COLORS.accentDeep,
  LAB:     COLORS.ok,
};

// ─────────────────────────────────────────────────────────────────
// Tab tones — Alerts Center categories
// ─────────────────────────────────────────────────────────────────
// Each alert tab gets a semantic tone color so the active-tab tint
// reads as a status, not a brand variant. Was previously sprayed
// across each tab as ad-hoc rgba() values.
export const ALERT_TAB_COLORS: Record<string, string> = {
  clinical: COLORS.accent,
  system:   COLORS.accentDeep, // was rgba(139,92,246,0.9) — violet leak
  staffing: COLORS.accentDeep, // same
  device:   COLORS.info,
  facility: COLORS.warn,
};

// ─────────────────────────────────────────────────────────────────
// Workforce / staffing surface tone — the single color PULSE uses
// when it needs to indicate "this is a workforce thing" (Request
// Float button on PulseHorizon, the WORKFORCE section header on
// MobileView). Was previously rgba(139,92,246,*) — violet leak.
// ─────────────────────────────────────────────────────────────────
export const STAFFING_TONE = COLORS.accentDeep;

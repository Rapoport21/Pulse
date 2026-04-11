/**
 * Clinical decision support — early warning scores.
 *
 * Implements the three bedside scores every modern EHR ships:
 *
 *   • MEWS — Modified Early Warning Score (Subbe 2001). The classic
 *     track-and-trigger score taught in every hospital nursing
 *     program. Low ceiling, easy to compute, used mostly on general
 *     wards. Range 0–14. ≥5 = escalate.
 *
 *   • NEWS2 — National Early Warning Score v2 (RCP 2017). The UK
 *     standard, endorsed by NHS England, and increasingly adopted in
 *     the US. Adds a SpO2 scale for type II respiratory failure and
 *     a supplemental-oxygen bonus. Range 0–20. ≥5 = urgent review,
 *     ≥7 = emergency.
 *
 *   • qSOFA — quick Sequential Organ Failure Assessment (Sepsis-3,
 *     JAMA 2016). Three binary criteria; ≥2 predicts in-hospital
 *     mortality from suspected infection. Range 0–3. It is *not*
 *     a screening tool — it's a prognostic indicator. Use alongside
 *     clinical suspicion of infection.
 *
 * These are pure functions. No React, no side effects. They read a
 * `Vital` and return an `EarlyWarningScore` with value, risk bucket,
 * action guidance, and a per-parameter breakdown so the UI can
 * explain *why* a score is what it is.
 *
 * Disclaimer: this is a demo. Real clinical deployment must validate
 * against a local gold-standard implementation and undergo clinical
 * governance review. These implementations match the published
 * scoring rules as of April 2026, with citations in comments.
 */

import type { EarlyWarningScore, Vital } from '../types';

// ─────────────────────────────────────────────────────────────────────────
// Internal helper — clamp-and-score with a default for missing data.
// Missing vitals score 0 rather than crash; the breakdown records null
// so the UI can show the gap.
// ─────────────────────────────────────────────────────────────────────────
interface Bin {
  label: string;
  min?: number;
  max?: number;
  points: number;
}

function scoreBin(value: number | undefined | null, bins: Bin[]): Bin {
  if (value == null || Number.isNaN(value)) {
    return { label: '—', points: 0 };
  }
  for (const bin of bins) {
    const aboveMin = bin.min == null || value >= bin.min;
    const belowMax = bin.max == null || value <= bin.max;
    if (aboveMin && belowMax) return bin;
  }
  return { label: '—', points: 0 };
}

// ─────────────────────────────────────────────────────────────────────────
// MEWS — Modified Early Warning Score
// Reference: Subbe CP, et al. QJM 2001;94:521–526.
//
// Parameters (0–3 each):
//   • Systolic BP
//   • Heart rate
//   • Respiratory rate
//   • Temperature
//   • AVPU / level of consciousness (we use GCS as a proxy)
// ─────────────────────────────────────────────────────────────────────────

const MEWS_SYSTOLIC: Bin[] = [
  { label: '≤70', max: 70, points: 3 },
  { label: '71–80', min: 71, max: 80, points: 2 },
  { label: '81–100', min: 81, max: 100, points: 1 },
  { label: '101–199', min: 101, max: 199, points: 0 },
  { label: '≥200', min: 200, points: 2 },
];

const MEWS_HEART_RATE: Bin[] = [
  { label: '<40', max: 39, points: 2 },
  { label: '40–50', min: 40, max: 50, points: 1 },
  { label: '51–100', min: 51, max: 100, points: 0 },
  { label: '101–110', min: 101, max: 110, points: 1 },
  { label: '111–129', min: 111, max: 129, points: 2 },
  { label: '≥130', min: 130, points: 3 },
];

const MEWS_RESP_RATE: Bin[] = [
  { label: '<9', max: 8, points: 2 },
  { label: '9–14', min: 9, max: 14, points: 0 },
  { label: '15–20', min: 15, max: 20, points: 1 },
  { label: '21–29', min: 21, max: 29, points: 2 },
  { label: '≥30', min: 30, points: 3 },
];

const MEWS_TEMPERATURE: Bin[] = [
  { label: '<35', max: 34.9, points: 2 },
  { label: '35–38.4', min: 35, max: 38.4, points: 0 },
  { label: '≥38.5', min: 38.5, points: 2 },
];

// AVPU mapping from GCS: A = 15, V = 13–14, P = 9–12, U = ≤8
function mewsAvpuPoints(gcs: number | undefined | null): { label: string; points: number } {
  if (gcs == null) return { label: '—', points: 0 };
  if (gcs === 15) return { label: 'Alert', points: 0 };
  if (gcs >= 13) return { label: 'Verbal', points: 1 };
  if (gcs >= 9) return { label: 'Pain', points: 2 };
  return { label: 'Unresponsive', points: 3 };
}

export function computeMEWS(v: Vital): EarlyWarningScore {
  const sys = scoreBin(v.systolic, MEWS_SYSTOLIC);
  const hr = scoreBin(v.heartRate, MEWS_HEART_RATE);
  const rr = scoreBin(v.respRate, MEWS_RESP_RATE);
  const temp = scoreBin(v.temperature, MEWS_TEMPERATURE);
  const avpu = mewsAvpuPoints(v.gcs);

  const total = sys.points + hr.points + rr.points + temp.points + avpu.points;
  const risk: EarlyWarningScore['risk'] =
    total >= 7 ? 'critical' : total >= 5 ? 'high' : total >= 3 ? 'moderate' : 'low';

  const action =
    risk === 'critical'
      ? 'IMMEDIATE ATTENDING BEDSIDE · activate rapid response'
      : risk === 'high'
      ? 'URGENT MD REVIEW · vital signs q15min · notify charge RN'
      : risk === 'moderate'
      ? 'INCREASED MONITORING · vital signs q1h · notify primary RN'
      : 'ROUTINE · continue scheduled monitoring';

  return {
    name: 'MEWS',
    value: total,
    maxValue: 14,
    risk,
    action,
    breakdown: [
      { parameter: `Systolic BP ${sys.label}`, rawValue: v.systolic ?? null, points: sys.points },
      { parameter: `Heart rate ${hr.label}`, rawValue: v.heartRate ?? null, points: hr.points },
      { parameter: `Resp rate ${rr.label}`, rawValue: v.respRate ?? null, points: rr.points },
      { parameter: `Temp ${temp.label}°C`, rawValue: v.temperature ?? null, points: temp.points },
      { parameter: `AVPU ${avpu.label}`, rawValue: v.gcs ?? null, points: avpu.points },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// NEWS2 — National Early Warning Score 2
// Reference: Royal College of Physicians NEWS2 final report 2017.
//
// Parameters (0–3 each, +2 for supplemental O2):
//   • Respiratory rate
//   • SpO2 — Scale 1 (general) used by default
//   • Supplemental oxygen (+2 if any)
//   • Systolic BP
//   • Heart rate
//   • Consciousness (AVPU; alert = 0, anything else = 3)
//   • Temperature
//
// Note: NEWS2 has a Scale 2 SpO2 table for patients with known
// hypercapnic respiratory failure (COPD on home O2). This
// implementation uses Scale 1 only — Scale 2 would need the
// problem list to flag eligible patients.
// ─────────────────────────────────────────────────────────────────────────

const NEWS2_RESP_RATE: Bin[] = [
  { label: '≤8', max: 8, points: 3 },
  { label: '9–11', min: 9, max: 11, points: 1 },
  { label: '12–20', min: 12, max: 20, points: 0 },
  { label: '21–24', min: 21, max: 24, points: 2 },
  { label: '≥25', min: 25, points: 3 },
];

const NEWS2_SPO2_SCALE1: Bin[] = [
  { label: '≤91', max: 91, points: 3 },
  { label: '92–93', min: 92, max: 93, points: 2 },
  { label: '94–95', min: 94, max: 95, points: 1 },
  { label: '≥96', min: 96, points: 0 },
];

const NEWS2_SYSTOLIC: Bin[] = [
  { label: '≤90', max: 90, points: 3 },
  { label: '91–100', min: 91, max: 100, points: 2 },
  { label: '101–110', min: 101, max: 110, points: 1 },
  { label: '111–219', min: 111, max: 219, points: 0 },
  { label: '≥220', min: 220, points: 3 },
];

const NEWS2_HEART_RATE: Bin[] = [
  { label: '≤40', max: 40, points: 3 },
  { label: '41–50', min: 41, max: 50, points: 1 },
  { label: '51–90', min: 51, max: 90, points: 0 },
  { label: '91–110', min: 91, max: 110, points: 1 },
  { label: '111–130', min: 111, max: 130, points: 2 },
  { label: '≥131', min: 131, points: 3 },
];

const NEWS2_TEMPERATURE: Bin[] = [
  { label: '≤35', max: 35, points: 3 },
  { label: '35.1–36.0', min: 35.1, max: 36.0, points: 1 },
  { label: '36.1–38.0', min: 36.1, max: 38.0, points: 0 },
  { label: '38.1–39.0', min: 38.1, max: 39.0, points: 1 },
  { label: '≥39.1', min: 39.1, points: 2 },
];

function news2ConsciousnessPoints(gcs: number | undefined | null): { label: string; points: number } {
  if (gcs == null) return { label: '—', points: 0 };
  if (gcs === 15) return { label: 'Alert', points: 0 };
  // NEWS2 treats anything less than fully alert ("new confusion") as 3 points.
  return { label: 'CVPU+', points: 3 };
}

export function computeNEWS2(v: Vital): EarlyWarningScore {
  const rr = scoreBin(v.respRate, NEWS2_RESP_RATE);
  const spo2 = scoreBin(v.spO2, NEWS2_SPO2_SCALE1);
  const o2Bonus = v.fio2 != null && v.fio2 > 0.21 ? 2 : 0;
  const sys = scoreBin(v.systolic, NEWS2_SYSTOLIC);
  const hr = scoreBin(v.heartRate, NEWS2_HEART_RATE);
  const cons = news2ConsciousnessPoints(v.gcs);
  const temp = scoreBin(v.temperature, NEWS2_TEMPERATURE);

  const total =
    rr.points + spo2.points + o2Bonus + sys.points + hr.points + cons.points + temp.points;

  // NEWS2 published thresholds:
  //   0      → routine ward-based monitoring
  //   1–4    → low — ward-based response
  //   3 in a single parameter → low-medium
  //   5–6    → medium — urgent review
  //   ≥7     → high — emergency response
  const hasRed = [rr, spo2, sys, hr, cons, temp].some((b) => b.points === 3);
  const risk: EarlyWarningScore['risk'] =
    total >= 7 ? 'critical' : total >= 5 ? 'high' : total >= 1 || hasRed ? 'moderate' : 'low';

  const action =
    total >= 7
      ? 'EMERGENCY · continuous monitoring · critical care team to bedside'
      : total >= 5
      ? 'URGENT · provider review within 1h · vitals q15min'
      : hasRed
      ? 'PARAMETER RED · vitals q1h · clinician aware of single red flag'
      : total >= 1
      ? 'ROUTINE+ · vitals q4–6h · continue monitoring'
      : 'ROUTINE · scheduled monitoring';

  return {
    name: 'NEWS2',
    value: total,
    maxValue: 20,
    risk,
    action,
    breakdown: [
      { parameter: `Resp rate ${rr.label}`, rawValue: v.respRate ?? null, points: rr.points },
      { parameter: `SpO₂ Scale 1 ${spo2.label}`, rawValue: v.spO2 ?? null, points: spo2.points },
      { parameter: `Supplemental O₂`, rawValue: v.fio2 != null ? `${Math.round(v.fio2 * 100)}%` : null, points: o2Bonus },
      { parameter: `Systolic BP ${sys.label}`, rawValue: v.systolic ?? null, points: sys.points },
      { parameter: `Heart rate ${hr.label}`, rawValue: v.heartRate ?? null, points: hr.points },
      { parameter: `Consciousness ${cons.label}`, rawValue: v.gcs ?? null, points: cons.points },
      { parameter: `Temp ${temp.label}°C`, rawValue: v.temperature ?? null, points: temp.points },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// qSOFA — quick Sepsis-related Organ Failure Assessment
// Reference: Singer M et al., The Third International Consensus
// Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA 2016.
//
// Three binary criteria, 1 point each:
//   • Altered mental status (GCS <15)
//   • Respiratory rate ≥ 22
//   • Systolic BP ≤ 100
//
// ≥2 is associated with increased mortality in suspected infection.
// qSOFA is a *prognostic* tool, not a screening tool — the user is
// expected to pair it with clinical suspicion of infection.
// ─────────────────────────────────────────────────────────────────────────

export function computeQSOFA(v: Vital): EarlyWarningScore {
  const mentalPts = v.gcs != null && v.gcs < 15 ? 1 : 0;
  const rrPts = v.respRate != null && v.respRate >= 22 ? 1 : 0;
  const sysPts = v.systolic != null && v.systolic <= 100 ? 1 : 0;
  const total = mentalPts + rrPts + sysPts;

  const risk: EarlyWarningScore['risk'] =
    total >= 2 ? 'critical' : total === 1 ? 'moderate' : 'low';

  const action =
    total >= 2
      ? 'HIGH RISK MORTALITY · lactate, blood cultures, broad-spectrum abx within 1h if infection suspected'
      : total === 1
      ? 'SCREEN POSITIVE · reassess q15min · consider sepsis workup'
      : 'NEGATIVE · continue routine monitoring';

  return {
    name: 'qSOFA',
    value: total,
    maxValue: 3,
    risk,
    action,
    breakdown: [
      { parameter: 'Altered mental status (GCS <15)', rawValue: v.gcs ?? null, points: mentalPts },
      { parameter: 'Respiratory rate ≥22', rawValue: v.respRate ?? null, points: rrPts },
      { parameter: 'Systolic BP ≤100', rawValue: v.systolic ?? null, points: sysPts },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Convenience — compute all three at once. Most callers want the
// triad, because "the patient is sick" shows up on different scores at
// different times.
// ─────────────────────────────────────────────────────────────────────────
export function computeAllScores(v: Vital): {
  mews: EarlyWarningScore;
  news2: EarlyWarningScore;
  qsofa: EarlyWarningScore;
} {
  return {
    mews: computeMEWS(v),
    news2: computeNEWS2(v),
    qsofa: computeQSOFA(v),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Score history — takes a vital timeline and returns a matched score
// timeline so the UI can show a score sparkline alongside the vitals.
// ─────────────────────────────────────────────────────────────────────────
export function scoreTimeline(
  vitalsHistory: Vital[],
  scorer: (v: Vital) => EarlyWarningScore,
): Array<{ timestamp: string; value: number; risk: EarlyWarningScore['risk'] }> {
  return vitalsHistory.map((v) => {
    const s = scorer(v);
    return { timestamp: v.timestamp, value: s.value, risk: s.risk };
  });
}

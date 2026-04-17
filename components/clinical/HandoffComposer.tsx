/**
 * HandoffComposer — fullscreen SBAR shift-handoff overlay (3-step wizard).
 *   1. Patient List — select patients for handoff
 *   2. SBAR Editor — edit pre-filled S/B/A/R per patient
 *   3. Review & Send — preview, copy, print, or transmit
 */
import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, BrainCircuit, CheckCircle2, ClipboardCopy, Printer, Send, Users, X } from 'lucide-react';
import { COLORS, FONTS, SPACE, RADIUS, MOTION, TYPE, Z, Mono, BracketLabel, StatusPill, TacticalCard, TacticalButton, HudStrip, ScanningLine, Divider } from '../design';
import { MOCK_PATIENTS, ageInYears } from '../../data/clinicalMock';
import { computeMEWS } from '../../lib/clinicalScores';
import type { Patient } from '../../types';

// ── Types & constants ───────────────────────────────────────────────────

export interface HandoffComposerProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

type Step = 'patients' | 'sbar' | 'review';
const STEP_ORDER: Step[] = ['patients', 'sbar', 'review'];
const STEP_LABELS: Record<Step, string> = { patients: 'Patients', sbar: 'SBAR Editor', review: 'Review' };

interface SbarNote { situation: string; background: string; assessment: string; recommendation: string }

const SBAR_SECTIONS: { key: keyof SbarNote; label: string; prefix: string; tone: string }[] = [
  { key: 'situation', label: 'S - Situation', prefix: 'S', tone: COLORS.info },
  { key: 'background', label: 'B - Background', prefix: 'B', tone: COLORS.textSecondary },
  { key: 'assessment', label: 'A - Assessment', prefix: 'A', tone: COLORS.warn },
  { key: 'recommendation', label: 'R - Recommendation', prefix: 'R', tone: COLORS.ok },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const mewsTone = (risk: string): 'ok' | 'warn' | 'crit' | 'info' =>
  risk === 'critical' ? 'crit' : risk === 'high' || risk === 'moderate' ? 'warn' : 'ok';

const statusAccent = (risk: string): string =>
  risk === 'critical' ? COLORS.crit : risk === 'high' || risk === 'moderate' ? COLORS.warn : COLORS.ok;

const latestMews = (p: Patient) => {
  const v = p.vitalsHistory[p.vitalsHistory.length - 1];
  return v ? computeMEWS(v) : null;
};

const buildSbar = (p: Patient): SbarNote => {
  const age = ageInYears(p.birthDate);
  const bed = p.currentEncounter?.location?.bed ?? 'unassigned';
  const zone = p.currentEncounter?.location?.zone ?? '';
  const complaint = p.currentEncounter?.chiefComplaint ?? 'no chief complaint documented';
  const v = p.vitalsHistory[p.vitalsHistory.length - 1];
  const mews = v ? computeMEWS(v) : null;

  const bgParts: string[] = [];
  bgParts.push(p.problems.length ? `PMH: ${p.problems.map((pr) => pr.display).join(', ')}.` : 'No significant past medical history.');
  bgParts.push(p.allergies.length ? `Allergies: ${p.allergies.map((a) => `${a.substance} (${a.reaction})`).join(', ')}.` : 'NKA.');
  bgParts.push(`Code status: ${p.codeStatus}. Isolation: ${p.isolation}.`);

  const aParts: string[] = [];
  if (mews) aParts.push(`MEWS ${mews.value} (${mews.risk} risk).`);
  if (v) aParts.push(`Latest vitals: HR ${v.heartRate}, BP ${v.systolic}/${v.diastolic}, RR ${v.respRate}, SpO2 ${v.spO2}%, T ${v.temperature.toFixed(1)}C.`);

  return {
    situation: `Patient ${p.name.family}, ${p.name.given}, ${age}${p.sex}, in ${zone} bed ${bed} for ${complaint}.`,
    background: bgParts.join(' '),
    assessment: aParts.join(' ') || 'No vitals available for assessment.',
    recommendation: '',
  };
};

const aiDraft = (p: Patient): SbarNote => {
  const base = buildSbar(p);
  const age = ageInYears(p.birthDate);
  const v = p.vitalsHistory[p.vitalsHistory.length - 1];
  const mews = v ? computeMEWS(v) : null;
  const recs: string[] = [];
  if (mews && (mews.risk === 'critical' || mews.risk === 'high')) {
    recs.push('Continue close monitoring with vital signs q15min.', 'Attending to be notified of any further deterioration.');
  } else if (mews && mews.risk === 'moderate') {
    recs.push('Increase monitoring frequency to q1h.', 'Re-assess in 2 hours.');
  } else {
    recs.push('Continue routine monitoring per protocol.');
  }
  if (p.currentEncounter?.esi && p.currentEncounter.esi <= 2) recs.push('Maintain current ESI level -- reassess if clinical status changes.');
  if (p.isolation !== 'NONE') recs.push(`Maintain ${p.isolation} precautions.`);
  return {
    ...base,
    assessment: `${age}${p.sex} presenting with ${p.currentEncounter?.chiefComplaint ?? 'unknown'}. ${base.assessment} ${mews && mews.risk !== 'low' ? `Trending toward ${mews.risk} acuity.` : 'Currently clinically stable.'}`,
    recommendation: recs.join(' '),
  };
};

// ── Shared micro-components ─────────────────────────────────────────────

const InfoRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Mono tone="muted" size="xs">{label}</Mono>
    <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, fontWeight: 500, color: valueColor ?? COLORS.textPrimary }}>{value}</span>
  </div>
);

const Checkbox: React.FC<{ checked: boolean; color: string }> = ({ checked, color }) => (
  <div style={{ width: 20, height: 20, borderRadius: RADIUS.sm, background: checked ? `${color}18` : COLORS.surface, border: `1.5px solid ${checked ? color : COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: `all ${MOTION.fast}s ease` }}>
    {checked && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ fontSize: 13, color, lineHeight: 1 }}>{'\u2713'}</motion.span>}
  </div>
);

const AccentBar: React.FC<{ color: string; opacity?: number }> = ({ color, opacity = 1 }) => (
  <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, opacity, transition: `opacity ${MOTION.fast}s ease` }} />
);

const StatusDot: React.FC<{ color: string; size?: number }> = ({ color, size = 8 }) => (
  <span style={{ width: size, height: size, borderRadius: RADIUS.full, background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
);

// ── Component ───────────────────────────────────────────────────────────

export const HandoffComposer: React.FC<HandoffComposerProps> = ({ open, onClose, showToast }) => {
  const [step, setStep] = useState<Step>('patients');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(MOCK_PATIENTS.map((p) => p.id)));
  const [sbarNotes, setSbarNotes] = useState<Record<string, SbarNote>>({});
  const [sent, setSent] = useState(false);
  const stepIndex = STEP_ORDER.indexOf(step);

  const ensureSbar = useCallback(() => {
    setSbarNotes((prev) => {
      const next = { ...prev };
      for (const p of MOCK_PATIENTS) if (selected.has(p.id) && !next[p.id]) next[p.id] = buildSbar(p);
      return next;
    });
  }, [selected]);

  const selectedPatients = useMemo(() => MOCK_PATIENTS.filter((p) => selected.has(p.id)), [selected]);

  const reset = () => { setStep('patients'); setSelected(new Set(MOCK_PATIENTS.map((p) => p.id))); setSbarNotes({}); setSent(false); };
  const handleClose = () => { reset(); onClose(); };
  const goNext = () => { if (step === 'patients') ensureSbar(); const i = STEP_ORDER.indexOf(step); if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]); };
  const goBack = () => { const i = STEP_ORDER.indexOf(step); if (i > 0) setStep(STEP_ORDER[i - 1]); };
  const togglePatient = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === MOCK_PATIENTS.length ? new Set() : new Set(MOCK_PATIENTS.map((p) => p.id)));
  const updateSbar = (pid: string, field: keyof SbarNote, val: string) => setSbarNotes((prev) => ({ ...prev, [pid]: { ...prev[pid], [field]: val } }));

  const buildFullText = (): string => {
    const now = new Date();
    const shift = now.getHours() < 12 ? 'Night to Day' : now.getHours() < 20 ? 'Day to Evening' : 'Evening to Night';
    const lines = [`=== SHIFT HANDOFF REPORT ===`, `Date: ${now.toLocaleDateString()}`, `Shift: ${shift}`, `Patients: ${selectedPatients.length}`, `Generated: ${now.toLocaleTimeString()}`, ''];
    for (const p of selectedPatients) {
      const n = sbarNotes[p.id]; if (!n) continue;
      lines.push(`--- ${p.name.family}, ${p.name.given} (${p.id}) ---`, `[S] ${n.situation}`, `[B] ${n.background}`, `[A] ${n.assessment}`, `[R] ${n.recommendation || '(none)'}`, '');
    }
    return lines.join('\n');
  };

  const handleSend = () => { setSent(true); showToast(`Handoff sent -- ${selectedPatients.length} patient${selectedPatients.length !== 1 ? 's' : ''}`); };
  const handleCopy = () => navigator.clipboard.writeText(buildFullText()).then(() => showToast('Handoff copied to clipboard'), () => showToast('Failed to copy'));
  const handlePrint = () => showToast('Print dialog opened (mock)');
  const canProceed = step === 'patients' ? selected.size > 0 : step === 'sbar' ? true : !sent;

  // ── Step indicator ────────────────────────────────────────────────────
  const renderStepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, padding: `${SPACE.md}px ${SPACE.base}px` }}>
      {STEP_ORDER.map((s, i) => {
        const cur = s === step, done = i < stepIndex;
        return (
          <React.Fragment key={s}>
            {i > 0 && <div style={{ flex: 1, height: 1, background: done ? COLORS.accent : COLORS.border }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: RADIUS.full, background: done ? COLORS.accent : cur ? COLORS.accentDim : COLORS.surface, border: `1.5px solid ${done || cur ? COLORS.accent : COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: FONTS.mono, fontWeight: 600, color: done ? COLORS.textPrimary : cur ? COLORS.accent : COLORS.textMuted }}>
                {done ? '\u2713' : i + 1}
              </div>
              <Mono tone={cur ? 'accent' : done ? 'primary' : 'muted'} size="xs">{STEP_LABELS[s]}</Mono>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // ── Step 1: Patient selection ─────────────────────────────────────────
  const renderPatientList = () => (
    <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <Users size={15} color={COLORS.textMuted} />
          <Mono tone="secondary" size="sm">Assigned Patients</Mono>
        </div>
        <motion.button onClick={toggleAll} whileTap={{ scale: 0.96 }} style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, padding: `4px ${SPACE.sm}px`, cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.accent, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>
          {selected.size === MOCK_PATIENTS.length ? 'Deselect All' : 'Select All'}
        </motion.button>
      </div>
      <Mono tone={selected.size > 0 ? 'accent' : 'warn'} size="xs">{selected.size}/{MOCK_PATIENTS.length} selected for handoff</Mono>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        {MOCK_PATIENTS.map((p) => {
          const checked = selected.has(p.id);
          const mews = latestMews(p);
          const accent = mews ? statusAccent(mews.risk) : COLORS.ok;
          const tone = mews ? mewsTone(mews.risk) : 'ok' as const;
          const bed = p.currentEncounter?.location?.bed ?? '--';
          return (
            <motion.button key={p.id} onClick={() => togglePatient(p.id)} whileTap={{ scale: 0.98 }} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: SPACE.md, padding: SPACE.md, background: checked ? `${accent}08` : COLORS.surface, border: `1px solid ${checked ? `${accent}30` : COLORS.border}`, borderRadius: RADIUS.sm, cursor: 'pointer', textAlign: 'left', transition: `all ${MOTION.fast}s ease`, outline: 'none', width: '100%', overflow: 'hidden' }}>
              <AccentBar color={accent} opacity={checked ? 1 : 0.3} />
              <Checkbox checked={checked} color={accent} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: 4 }}>
                  <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.body.size, fontWeight: 600, color: COLORS.textPrimary }}>{p.name.family}, {p.name.given}</span>
                  <Mono tone="muted" size="xs">{ageInYears(p.birthDate)}{p.sex}</Mono>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: 4 }}>
                  <Mono tone="secondary" size="xs">Bed {bed}</Mono>
                  {mews && <StatusPill label={`MEWS ${mews.value}`} tone={tone} />}
                </div>
                <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textMuted, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.currentEncounter?.chiefComplaint ?? '--'}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  // ── Step 2: SBAR Editor ───────────────────────────────────────────────
  const renderSbarEditor = () => (
    <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
      {selectedPatients.map((p) => {
        const note = sbarNotes[p.id]; if (!note) return null;
        const mews = latestMews(p);
        const accent = mews ? statusAccent(mews.risk) : COLORS.ok;
        const tone = mews ? mewsTone(mews.risk) : 'ok' as const;
        return (
          <div key={p.id}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md, paddingBottom: SPACE.sm, borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <StatusDot color={accent} />
                <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.h3.size, fontWeight: TYPE.h3.weight, color: COLORS.textPrimary }}>{p.name.family}, {p.name.given}</span>
                <Mono tone="muted" size="xs">Bed {p.currentEncounter?.location?.bed ?? '--'}</Mono>
                {mews && <StatusPill label={`MEWS ${mews.value}`} tone={tone} />}
              </div>
              <motion.button onClick={() => setSbarNotes((prev) => ({ ...prev, [p.id]: aiDraft(p) }))} whileTap={{ scale: 0.95 }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `4px ${SPACE.sm}px`, background: `${COLORS.accent}10`, border: `1px solid ${COLORS.accent}40`, borderRadius: RADIUS.sm, cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 11, color: COLORS.accent, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>
                <BrainCircuit size={13} /> AI Draft
              </motion.button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
              {SBAR_SECTIONS.map((sec) => (
                <div key={sec.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: 4 }}>
                    <span style={{ width: 20, height: 20, borderRadius: RADIUS.sm, background: `${sec.tone}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color: sec.tone }}>{sec.prefix}</span>
                    <Mono tone="secondary" size="xs">{sec.label}</Mono>
                  </div>
                  <textarea
                    value={note[sec.key]}
                    onChange={(e) => updateSbar(p.id, sec.key, e.target.value)}
                    rows={sec.key === 'recommendation' ? 3 : 2}
                    placeholder={sec.key === 'recommendation' ? 'Enter priorities and recommendations for the incoming team...' : undefined}
                    style={{ width: '100%', boxSizing: 'border-box', padding: SPACE.sm, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${sec.tone}`, borderRadius: RADIUS.sm, fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textPrimary, lineHeight: 1.5, resize: 'vertical', outline: 'none' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = sec.tone; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.borderLeftColor = sec.tone; }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Step 3: Review & Send ─────────────────────────────────────────────
  const renderReview = () => {
    const now = new Date();
    const shift = now.getHours() < 12 ? 'Night to Day' : now.getHours() < 20 ? 'Day to Evening' : 'Evening to Night';
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (sent) {
      return (
        <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: MOTION.base, ease: MOTION.ease }}>
            <TacticalCard highlight accentBar padding="lg">
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                <ScanningLine duration={6} />
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.base }}>
                  <div style={{ width: 36, height: 36, borderRadius: RADIUS.full, background: `${COLORS.ok}18`, border: `1.5px solid ${COLORS.ok}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={20} color={COLORS.ok} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.h3.size, fontWeight: TYPE.h3.weight, color: COLORS.ok }}>Handoff Sent</div>
                    <Mono tone="secondary" size="xs">{timeStr}</Mono>
                  </div>
                </div>
                <Divider style={{ margin: `${SPACE.sm}px 0` }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, marginTop: SPACE.md }}>
                  <InfoRow label="Patients" value={`${selectedPatients.length}`} />
                  <InfoRow label="Shift" value={shift} />
                  <InfoRow label="Status" value="Delivered to incoming team" valueColor={COLORS.ok} />
                </div>
              </div>
            </TacticalCard>
          </motion.div>
          <TacticalButton variant="secondary" fullWidth onClick={handleClose}>Close</TacticalButton>
        </div>
      );
    }

    return (
      <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
        <TacticalCard padding="md">
          <BracketLabel tone="accent" size="sm" style={{ marginBottom: SPACE.md, display: 'block' }}>Handoff Summary</BracketLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            <InfoRow label="Patients" value={`${selectedPatients.length}`} />
            <InfoRow label="Shift" value={shift} />
            <InfoRow label="Time" value={timeStr} />
            <InfoRow label="From" value="Current Provider" />
            <InfoRow label="To" value="Incoming Team" />
          </div>
        </TacticalCard>

        {selectedPatients.map((p) => {
          const note = sbarNotes[p.id]; if (!note) return null;
          const mews = latestMews(p);
          const accent = mews ? statusAccent(mews.risk) : COLORS.ok;
          return (
            <TacticalCard key={p.id} padding="md">
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md, paddingBottom: SPACE.sm, borderBottom: `1px solid ${COLORS.border}` }}>
                <StatusDot color={accent} size={6} />
                <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.body.size, fontWeight: 600, color: COLORS.textPrimary }}>{p.name.family}, {p.name.given}</span>
                <Mono tone="muted" size="xs">Bed {p.currentEncounter?.location?.bed ?? '--'}</Mono>
              </div>
              {SBAR_SECTIONS.map((sec) => (
                <div key={sec.key} style={{ marginBottom: SPACE.sm }}>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color: sec.tone }}>[{sec.prefix}]</span>
                  <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: note[sec.key] ? COLORS.textSecondary : COLORS.textMuted, lineHeight: 1.5, fontStyle: note[sec.key] ? 'normal' : 'italic' }}>
                    {note[sec.key] || '(not filled)'}
                  </div>
                </div>
              ))}
            </TacticalCard>
          );
        })}

        <div style={{ display: 'flex', gap: SPACE.sm }}>
          <TacticalButton variant="ghost" onClick={handleCopy} icon={<ClipboardCopy size={15} />}>Copy</TacticalButton>
          <TacticalButton variant="ghost" onClick={handlePrint} icon={<Printer size={15} />}>Print</TacticalButton>
        </div>
        <TacticalButton variant="primary" fullWidth onClick={handleSend} icon={<Send size={15} />}>Send to Incoming Team</TacticalButton>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="handoff-composer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: MOTION.fast }} style={{ position: 'fixed', inset: 0, zIndex: Z.modal, background: COLORS.bg, display: 'flex', flexDirection: 'column', fontFamily: FONTS.sans, color: COLORS.textPrimary, overflow: 'hidden', paddingTop: 'env(safe-area-inset-top)' }}>
          {/* Header */}
          <HudStrip side="top" fixed>
            <button onClick={handleClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, color: COLORS.textSecondary, cursor: 'pointer' }}>
              <X size={15} />
            </button>
            <BracketLabel tone="accent" size="sm">Shift Handoff</BracketLabel>
            <div style={{ flex: 1 }} />
            <StatusPill label={`${selected.size} PT`} tone={selected.size > 0 ? 'info' : 'neutral'} />
          </HudStrip>

          {/* Body */}
          <div style={{ flex: 1, overflow: 'auto', paddingTop: 56, paddingBottom: 72, WebkitOverflowScrolling: 'touch' }}>
            {renderStepIndicator()}
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: MOTION.fast, ease: MOTION.ease }}>
                {step === 'patients' && renderPatientList()}
                {step === 'sbar' && renderSbarEditor()}
                {step === 'review' && renderReview()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer nav */}
          {!sent && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: SPACE.sm, padding: `${SPACE.md}px ${SPACE.base}px`, paddingBottom: `max(${SPACE.md}px, env(safe-area-inset-bottom))`, background: `linear-gradient(180deg, ${COLORS.bg}00 0%, ${COLORS.bg} 20%)`, borderTop: `1px solid ${COLORS.border}`, zIndex: Z.modal + 1 }}>
              {stepIndex > 0 && <TacticalButton variant="ghost" onClick={goBack} icon={<ArrowLeft size={15} />}>Back</TacticalButton>}
              <div style={{ flex: 1 }} />
              {step !== 'review' && <TacticalButton variant="primary" onClick={goNext} disabled={!canProceed} icon={<ArrowRight size={15} />}>{step === 'sbar' ? 'Review' : 'Next'}</TacticalButton>}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

HandoffComposer.displayName = 'HandoffComposer';

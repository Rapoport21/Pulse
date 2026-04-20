/**
 * OrderEntry — fullscreen CPOE (Computerized Provider Order Entry) overlay
 * for placing medication orders, lab orders, imaging orders, and consults.
 *
 * Four category tabs:
 *   1. Medications — drug search, dose/route/frequency form, high-alert warnings
 *   2. Labs — quick-order grid of common panels with STAT toggle
 *   3. Imaging — modality grid with priority selector + clinical indication
 *   4. Consults — service list with urgency and reason for consult
 *
 * All orders accumulate in a shared basket; the Review & Sign screen lets
 * the provider inspect, remove, and co-sign all orders at once.
 *
 * Props:
 *   open       — controls overlay visibility
 *   onClose    — dismiss the overlay
 *   showToast  — fire a toast notification to the parent shell
 *   patientId  — optional patient identifier for context display
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  AlertTriangle,
  Pill,
  FlaskConical,
  ScanLine,
  Stethoscope,
  Trash2,
  ShieldCheck,
  Clock,
  Zap,
  FileText,
  ChevronRight,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION, cssTransition,
  TYPE,
  Z,
  MOBILE_NAV_OVERLAY_INSET_BOTTOM,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
  CornerBracket,
  TacticalButton,
  HudStrip,
  Divider,
} from '../design';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface OrderEntryProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  patientId?: string;
}

type Category = 'meds' | 'labs' | 'imaging' | 'consults';
type Priority = 'routine' | 'urgent' | 'stat';

interface MedOrder {
  type: 'med';
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  highAlert: boolean;
}
interface LabOrder { type: 'lab'; name: string; stat: boolean; tat: string; }
interface ImagingOrder {
  type: 'imaging';
  study: string;
  priority: Priority;
  indication: string;
  tat: string;
}
interface ConsultOrder {
  type: 'consult';
  service: string;
  urgency: Priority;
  reason: string;
}
type Order = MedOrder | LabOrder | ImagingOrder | ConsultOrder;

// ─────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: 'meds', label: 'Medications', icon: <Pill size={13} /> },
  { id: 'labs', label: 'Labs', icon: <FlaskConical size={13} /> },
  { id: 'imaging', label: 'Imaging', icon: <ScanLine size={13} /> },
  { id: 'consults', label: 'Consults', icon: <Stethoscope size={13} /> },
];

const ED_MEDS = [
  { name: 'Morphine', highAlert: true },
  { name: 'Heparin', highAlert: true },
  { name: 'Vancomycin', highAlert: false },
  { name: 'Ceftriaxone', highAlert: false },
  { name: 'Normal Saline', highAlert: false },
  { name: 'Acetaminophen', highAlert: false },
  { name: 'Ketorolac', highAlert: false },
  { name: 'Ondansetron', highAlert: false },
];

const ROUTES = ['IV', 'PO', 'IM', 'SubQ'];
const FREQUENCIES = ['Once', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'Continuous'];

const LAB_PANELS = [
  { name: 'BMP', tat: '45 min' },
  { name: 'CBC', tat: '30 min' },
  { name: 'CMP', tat: '60 min' },
  { name: 'Troponin', tat: '40 min' },
  { name: 'Lactate', tat: '20 min' },
  { name: 'Blood Culture', tat: '72 hr' },
  { name: 'Coag Panel', tat: '45 min' },
  { name: 'UA', tat: '30 min' },
  { name: 'Type & Screen', tat: '60 min' },
  { name: 'ABG', tat: '15 min' },
];

const IMAGING_STUDIES = [
  { name: 'Chest XR', tat: '30 min' },
  { name: 'CT Head', tat: '45 min' },
  { name: 'CT Abdomen', tat: '60 min' },
  { name: 'CT Chest PE Protocol', tat: '45 min' },
  { name: 'XR Extremity', tat: '25 min' },
  { name: 'FAST Exam', tat: '10 min' },
  { name: 'MRI Brain', tat: '90 min' },
  { name: 'Echo', tat: '60 min' },
];

const CONSULT_SERVICES = [
  'Cardiology', 'Surgery', 'Neurology', 'Nephrology',
  'Pulmonology', 'GI', 'Ortho', 'Psychiatry',
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function orderLabel(o: Order): string {
  switch (o.type) {
    case 'med': return `${o.drug} ${o.dose} ${o.route} ${o.frequency}`;
    case 'lab': return `${o.name}${o.stat ? ' (STAT)' : ''}`;
    case 'imaging': return `${o.study} — ${o.priority.toUpperCase()}`;
    case 'consult': return `${o.service} Consult — ${o.urgency.toUpperCase()}`;
  }
}

function orderCategoryLabel(o: Order): string {
  switch (o.type) {
    case 'med': return 'Medication';
    case 'lab': return 'Lab';
    case 'imaging': return 'Imaging';
    case 'consult': return 'Consult';
  }
}

const priorityColor = (p: Priority): string =>
  p === 'stat' ? COLORS.crit : p === 'urgent' ? COLORS.warn : COLORS.ok;

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const OrderEntry: React.FC<OrderEntryProps> = ({ open, onClose, showToast, patientId }) => {
  const [category, setCategory] = useState<Category>('meds');
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviewing, setReviewing] = useState(false);

  // -- Meds state
  const [medSearch, setMedSearch] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<typeof ED_MEDS[number] | null>(null);
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('IV');
  const [freq, setFreq] = useState('Once');
  const [duration, setDuration] = useState('');

  // -- Labs state
  const [selectedLabs, setSelectedLabs] = useState<Set<string>>(new Set());
  const [labStat, setLabStat] = useState(false);

  // -- Imaging state
  const [selectedStudy, setSelectedStudy] = useState<typeof IMAGING_STUDIES[number] | null>(null);
  const [imgPriority, setImgPriority] = useState<Priority>('routine');
  const [imgIndication, setImgIndication] = useState('');

  // -- Consults state
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [consultUrgency, setConsultUrgency] = useState<Priority>('routine');
  const [consultReason, setConsultReason] = useState('');

  const filteredMeds = useMemo(() => {
    if (!medSearch.trim()) return ED_MEDS;
    const q = medSearch.toLowerCase();
    return ED_MEDS.filter((m) => m.name.toLowerCase().includes(q));
  }, [medSearch]);

  const addOrder = useCallback((o: Order) => {
    setOrders((prev) => [...prev, o]);
  }, []);

  const removeOrder = useCallback((idx: number) => {
    setOrders((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const resetAll = () => {
    setCategory('meds');
    setOrders([]);
    setReviewing(false);
    setMedSearch('');
    setSelectedDrug(null);
    setDose('');
    setRoute('IV');
    setFreq('Once');
    setDuration('');
    setSelectedLabs(new Set());
    setLabStat(false);
    setSelectedStudy(null);
    setImgPriority('routine');
    setImgIndication('');
    setSelectedService(null);
    setConsultUrgency('routine');
    setConsultReason('');
  };

  const handleClose = () => { resetAll(); onClose(); };

  const handleSignAll = () => {
    const count = orders.length;
    showToast(`Signed ${count} order${count !== 1 ? 's' : ''} successfully`);
    resetAll();
    onClose();
  };

  // ── Meds: place order ───────────────────────────────────────────────
  const placeMedOrder = () => {
    if (!selectedDrug || !dose.trim()) return;
    addOrder({
      type: 'med',
      drug: selectedDrug.name,
      dose: dose.trim(),
      route,
      frequency: freq,
      duration: duration.trim() || 'PRN',
      highAlert: selectedDrug.highAlert,
    });
    setSelectedDrug(null);
    setDose('');
    setRoute('IV');
    setFreq('Once');
    setDuration('');
    setMedSearch('');
  };

  // ── Labs: add to basket ─────────────────────────────────────────────
  const addLabOrders = () => {
    selectedLabs.forEach((name) => {
      const panel = LAB_PANELS.find((p) => p.name === name);
      if (panel) addOrder({ type: 'lab', name, stat: labStat, tat: panel.tat });
    });
    setSelectedLabs(new Set());
    setLabStat(false);
  };

  // ── Imaging: place order ────────────────────────────────────────────
  const placeImagingOrder = () => {
    if (!selectedStudy || !imgIndication.trim()) return;
    addOrder({
      type: 'imaging',
      study: selectedStudy.name,
      priority: imgPriority,
      indication: imgIndication.trim(),
      tat: selectedStudy.tat,
    });
    setSelectedStudy(null);
    setImgPriority('routine');
    setImgIndication('');
  };

  // ── Consult: page ───────────────────────────────────────────────────
  const placeConsultOrder = () => {
    if (!selectedService || !consultReason.trim()) return;
    addOrder({
      type: 'consult',
      service: selectedService,
      urgency: consultUrgency,
      reason: consultReason.trim(),
    });
    setSelectedService(null);
    setConsultUrgency('routine');
    setConsultReason('');
  };

  // ── Shared input style ──────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 40,
    padding: `0 ${SPACE.md}px`,
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.textPrimary,
    background: COLORS.bgDeep,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.sm,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    height: 80,
    padding: SPACE.md,
    resize: 'none',
    lineHeight: 1.5,
  };

  // ── Pill selector helper ────────────────────────────────────────────
  const renderPills = (
    options: string[],
    selected: string,
    onSelect: (v: string) => void,
    colorFn?: (v: string) => string,
  ) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.xs }}>
      {options.map((opt) => {
        const active = selected === opt;
        const color = colorFn ? colorFn(opt) : COLORS.accent;
        return (
          <motion.button
            key={opt}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(opt)}
            style={{
              padding: `${SPACE.xs}px ${SPACE.md}px`,
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: active ? COLORS.textPrimary : COLORS.textMuted,
              background: active ? `${color}18` : COLORS.surface,
              border: `1px solid ${active ? color : COLORS.border}`,
              borderRadius: RADIUS.md,
              cursor: 'pointer',
              outline: 'none',
              transition: cssTransition(),
            }}
          >
            {opt}
          </motion.button>
        );
      })}
    </div>
  );

  // ── Category tabs ───────────────────────────────────────────────────
  const renderTabs = () => (
    <div style={{
      display: 'flex',
      gap: SPACE.xs,
      padding: `${SPACE.md}px ${SPACE.base}px`,
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {CATEGORIES.map((cat) => {
        const active = category === cat.id;
        return (
          <motion.button
            key={cat.id}
            whileTap={{ scale: 0.96 }}
            onClick={() => { setCategory(cat.id); setReviewing(false); }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: active ? COLORS.accent : COLORS.textMuted,
              background: active ? COLORS.accentDim : 'transparent',
              border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
              borderRadius: RADIUS.md,
              cursor: 'pointer',
              outline: 'none',
              transition: cssTransition(),
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {active && (
              <>
                <CornerBracket position="tl" size={6} />
                <CornerBracket position="br" size={6} />
              </>
            )}
            {cat.icon}
            {cat.label}
          </motion.button>
        );
      })}
    </div>
  );

  // ── Medications tab ─────────────────────────────────────────────────
  const renderMeds = () => (
    <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} color={COLORS.textMuted} style={{ position: 'absolute', left: 12, top: 13, pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Search medications..."
          value={medSearch}
          onChange={(e) => { setMedSearch(e.target.value); setSelectedDrug(null); }}
          style={{ ...inputStyle, paddingLeft: 34 }}
        />
      </div>

      {/* Results list */}
      {!selectedDrug && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          {filteredMeds.map((med) => (
            <motion.button
              key={med.name}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setSelectedDrug(med); setMedSearch(med.name); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: SPACE.md,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                cursor: 'pointer',
                outline: 'none',
                textAlign: 'left',
                width: '100%',
                transition: cssTransition(),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <Pill size={14} color={med.highAlert ? COLORS.warn : COLORS.textMuted} />
                <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.body.size, color: COLORS.textPrimary }}>
                  {med.name}
                </span>
                {med.highAlert && (
                  <span style={{
                    fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.12em', color: COLORS.warn, textTransform: 'uppercase',
                  }}>
                    HIGH-ALERT
                  </span>
                )}
              </div>
              <ChevronRight size={14} color={COLORS.textMuted} />
            </motion.button>
          ))}
          {filteredMeds.length === 0 && (
            <Mono tone="muted" size="sm" style={{ textAlign: 'center', padding: SPACE.xl }}>
              No medications match
            </Mono>
          )}
        </div>
      )}

      {/* Order form for selected drug */}
      {selectedDrug && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.fast }}
          style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}
        >
          {/* High-alert warning */}
          {selectedDrug.highAlert && (
            <TacticalCard padding="md" style={{ borderColor: `${COLORS.warn}60` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <AlertTriangle size={16} color={COLORS.warn} />
                <div>
                  <Mono tone="warn" size="sm">High-Alert Medication</Mono>
                  <div style={{
                    fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size,
                    color: COLORS.textSecondary, marginTop: 2, lineHeight: 1.4,
                  }}>
                    {selectedDrug.name} requires independent double-check before administration.
                  </div>
                </div>
              </div>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                background: COLORS.warn, boxShadow: `0 0 10px ${COLORS.warn}60`,
              }} />
            </TacticalCard>
          )}

          <TacticalCard padding="md">
            <BracketLabel tone="accent" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
              {selectedDrug.name} Order
            </BracketLabel>

            {/* Dose */}
            <div style={{ marginBottom: SPACE.md }}>
              <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>Dose</Mono>
              <input
                type="text"
                placeholder="e.g. 4mg, 1g, 1000mL"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Route */}
            <div style={{ marginBottom: SPACE.md }}>
              <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>Route</Mono>
              {renderPills(ROUTES, route, setRoute)}
            </div>

            {/* Frequency */}
            <div style={{ marginBottom: SPACE.md }}>
              <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>Frequency</Mono>
              {renderPills(FREQUENCIES, freq, setFreq)}
            </div>

            {/* Duration */}
            <div>
              <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>Duration</Mono>
              <input
                type="text"
                placeholder="e.g. 24h, 3 days, PRN"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={inputStyle}
              />
            </div>
          </TacticalCard>

          <div style={{ display: 'flex', gap: SPACE.sm }}>
            <TacticalButton
              variant="ghost"
              onClick={() => { setSelectedDrug(null); setMedSearch(''); }}
              style={{ flex: 1 }}
            >
              Cancel
            </TacticalButton>
            <TacticalButton
              variant="primary"
              disabled={!dose.trim()}
              onClick={placeMedOrder}
              icon={<Pill size={13} />}
              style={{ flex: 2 }}
            >
              Place Order
            </TacticalButton>
          </div>
        </motion.div>
      )}
    </div>
  );

  // ── Labs tab ────────────────────────────────────────────────────────
  const renderLabs = () => (
    <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
      {/* STAT toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Mono tone="secondary" size="sm">Select Lab Panels</Mono>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setLabStat(!labStat)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: `${SPACE.xs}px ${SPACE.md}px`,
            fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: labStat ? COLORS.crit : COLORS.ok,
            background: labStat ? COLORS.critDim : COLORS.okDim,
            border: `1px solid ${labStat ? COLORS.crit : COLORS.ok}`,
            borderRadius: RADIUS.md, cursor: 'pointer', outline: 'none',
            transition: cssTransition(),
          }}
        >
          <Zap size={12} />
          {labStat ? 'STAT' : 'Routine'}
        </motion.button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: SPACE.sm }}>
        {LAB_PANELS.map((panel) => {
          const selected = selectedLabs.has(panel.name);
          return (
            <motion.button
              key={panel.name}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setSelectedLabs((prev) => {
                  const next = new Set(prev);
                  if (next.has(panel.name)) next.delete(panel.name);
                  else next.add(panel.name);
                  return next;
                });
              }}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: SPACE.md,
                background: selected ? COLORS.accentDim : COLORS.surface,
                border: `1.5px solid ${selected ? COLORS.accent : COLORS.border}`,
                borderRadius: RADIUS.sm,
                cursor: 'pointer', outline: 'none',
                textAlign: 'left',
                transition: cssTransition(),
                overflow: 'hidden',
              }}
            >
              {selected && (
                <>
                  <CornerBracket position="tl" size={7} />
                  <CornerBracket position="br" size={7} />
                </>
              )}
              <span style={{
                fontFamily: FONTS.sans, fontSize: TYPE.body.size, fontWeight: 600,
                color: selected ? COLORS.textPrimary : COLORS.textSecondary,
              }}>
                {panel.name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} color={COLORS.textMuted} />
                <Mono tone="muted" size="xs">{panel.tat}</Mono>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Add to basket button */}
      {selectedLabs.size > 0 && (
        <TacticalButton
          variant="primary"
          fullWidth
          onClick={addLabOrders}
          icon={<FlaskConical size={13} />}
        >
          Add {selectedLabs.size} Lab{selectedLabs.size !== 1 ? 's' : ''} to Basket
        </TacticalButton>
      )}
    </div>
  );

  // ── Imaging tab ─────────────────────────────────────────────────────
  const renderImaging = () => (
    <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
      <Mono tone="secondary" size="sm">Select Imaging Study</Mono>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: SPACE.sm }}>
        {IMAGING_STUDIES.map((study) => {
          const selected = selectedStudy?.name === study.name;
          return (
            <motion.button
              key={study.name}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelectedStudy(selected ? null : study)}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: SPACE.md,
                background: selected ? COLORS.accentDim : COLORS.surface,
                border: `1.5px solid ${selected ? COLORS.accent : COLORS.border}`,
                borderRadius: RADIUS.sm,
                cursor: 'pointer', outline: 'none',
                textAlign: 'left',
                transition: cssTransition(),
                overflow: 'hidden',
              }}
            >
              {selected && (
                <>
                  <CornerBracket position="tl" size={7} />
                  <CornerBracket position="br" size={7} />
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ScanLine size={13} color={selected ? COLORS.accent : COLORS.textMuted} />
                <span style={{
                  fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, fontWeight: 600,
                  color: selected ? COLORS.textPrimary : COLORS.textSecondary,
                }}>
                  {study.name}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} color={COLORS.textMuted} />
                <Mono tone="muted" size="xs">{study.tat}</Mono>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Order detail form */}
      {selectedStudy && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.fast }}
        >
          <TacticalCard padding="md">
            <BracketLabel tone="accent" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
              {selectedStudy.name}
            </BracketLabel>

            {/* Priority */}
            <div style={{ marginBottom: SPACE.md }}>
              <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>Priority</Mono>
              {renderPills(
                ['routine', 'urgent', 'stat'],
                imgPriority,
                (v) => setImgPriority(v as Priority),
                priorityColor,
              )}
            </div>

            {/* Clinical indication (required) */}
            <div>
              <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>
                Clinical Indication <span style={{ color: COLORS.crit }}>*</span>
              </Mono>
              <textarea
                placeholder="Reason for study..."
                value={imgIndication}
                onChange={(e) => setImgIndication(e.target.value)}
                style={textareaStyle as React.CSSProperties}
              />
            </div>
          </TacticalCard>

          <div style={{ marginTop: SPACE.md }}>
            <TacticalButton
              variant="primary"
              fullWidth
              disabled={!imgIndication.trim()}
              onClick={placeImagingOrder}
              icon={<ScanLine size={13} />}
            >
              Place Imaging Order
            </TacticalButton>
          </div>
        </motion.div>
      )}
    </div>
  );

  // ── Consults tab ────────────────────────────────────────────────────
  const renderConsults = () => (
    <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
      <Mono tone="secondary" size="sm">Select Consulting Service</Mono>

      {/* Service list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
        {CONSULT_SERVICES.map((svc) => {
          const active = selectedService === svc;
          return (
            <motion.button
              key={svc}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedService(active ? null : svc)}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: SPACE.md,
                background: active ? COLORS.accentDim : COLORS.surface,
                border: `1.5px solid ${active ? COLORS.accent : COLORS.border}`,
                borderRadius: RADIUS.sm,
                cursor: 'pointer', outline: 'none',
                textAlign: 'left', width: '100%',
                transition: cssTransition(),
                overflow: 'hidden',
              }}
            >
              {active && (
                <>
                  <CornerBracket position="tl" size={7} />
                  <CornerBracket position="br" size={7} />
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <Stethoscope size={14} color={active ? COLORS.accent : COLORS.textMuted} />
                <span style={{
                  fontFamily: FONTS.sans, fontSize: TYPE.body.size, fontWeight: 500,
                  color: active ? COLORS.textPrimary : COLORS.textSecondary,
                }}>
                  {svc}
                </span>
              </div>
              {active && <ChevronRight size={14} color={COLORS.accent} />}
            </motion.button>
          );
        })}
      </div>

      {/* Consult detail form */}
      {selectedService && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.fast }}
        >
          <TacticalCard padding="md">
            <BracketLabel tone="accent" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
              {selectedService} Consult
            </BracketLabel>

            {/* Urgency */}
            <div style={{ marginBottom: SPACE.md }}>
              <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>Urgency</Mono>
              {renderPills(
                ['routine', 'urgent', 'stat'],
                consultUrgency,
                (v) => setConsultUrgency(v as Priority),
                priorityColor,
              )}
            </div>

            {/* Reason */}
            <div>
              <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>
                Reason for Consult <span style={{ color: COLORS.crit }}>*</span>
              </Mono>
              <textarea
                placeholder="Clinical question and relevant history..."
                value={consultReason}
                onChange={(e) => setConsultReason(e.target.value)}
                style={textareaStyle as React.CSSProperties}
              />
            </div>
          </TacticalCard>

          <div style={{ marginTop: SPACE.md }}>
            <TacticalButton
              variant="primary"
              fullWidth
              disabled={!consultReason.trim()}
              onClick={placeConsultOrder}
              icon={<Stethoscope size={13} />}
            >
              Page Consultant
            </TacticalButton>
          </div>
        </motion.div>
      )}
    </div>
  );

  // ── Review & Sign ───────────────────────────────────────────────────
  const renderReview = () => {
    const grouped = {
      med: orders.filter((o): o is MedOrder => o.type === 'med'),
      lab: orders.filter((o): o is LabOrder => o.type === 'lab'),
      imaging: orders.filter((o): o is ImagingOrder => o.type === 'imaging'),
      consult: orders.filter((o): o is ConsultOrder => o.type === 'consult'),
    };

    const sections: { key: string; label: string; icon: React.ReactNode; items: Order[] }[] = [
      { key: 'med', label: 'Medications', icon: <Pill size={13} />, items: grouped.med },
      { key: 'lab', label: 'Labs', icon: <FlaskConical size={13} />, items: grouped.lab },
      { key: 'imaging', label: 'Imaging', icon: <ScanLine size={13} />, items: grouped.imaging },
      { key: 'consult', label: 'Consults', icon: <Stethoscope size={13} />, items: grouped.consult },
    ].filter((s) => s.items.length > 0);

    return (
      <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <FileText size={14} color={COLORS.accent} />
          <Mono tone="accent" size="sm">Review Orders</Mono>
          <div style={{ flex: 1 }} />
          <StatusPill label={`${orders.length} PENDING`} tone="warn" />
        </div>

        {sections.map((section) => (
          <div key={section.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
              {section.icon}
              <Mono tone="secondary" size="xs">{section.label}</Mono>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
              {section.items.map((order) => {
                const globalIdx = orders.indexOf(order);
                return (
                  <div
                    key={globalIdx}
                    style={{
                      display: 'flex', alignItems: 'center', gap: SPACE.sm,
                      padding: SPACE.md,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size,
                        fontWeight: 500, color: COLORS.textPrimary,
                      }}>
                        {orderLabel(order)}
                      </span>
                      {order.type === 'med' && order.highAlert && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <AlertTriangle size={10} color={COLORS.warn} />
                          <Mono tone="warn" size="xs">High-Alert</Mono>
                        </div>
                      )}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeOrder(globalIdx)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, flexShrink: 0,
                        background: COLORS.critDim,
                        border: `1px solid ${COLORS.crit}30`,
                        borderRadius: RADIUS.sm,
                        cursor: 'pointer', outline: 'none',
                        color: COLORS.crit,
                      }}
                    >
                      <Trash2 size={13} />
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <Divider style={{ margin: `${SPACE.xs}px 0` }} />

        <TacticalButton
          variant="primary"
          fullWidth
          onClick={handleSignAll}
          icon={<ShieldCheck size={14} />}
        >
          Sign All Orders ({orders.length})
        </TacticalButton>

        <TacticalButton
          variant="ghost"
          fullWidth
          onClick={() => setReviewing(false)}
        >
          Back to Ordering
        </TacticalButton>
      </div>
    );
  };

  // ── Order basket bar ────────────────────────────────────────────────
  const renderBasket = () => {
    if (orders.length === 0 || reviewing) return null;
    return (
      <div style={{
        position: 'fixed',
        // Sit above MobileView's bottom HUD nav so app tabs stay visible.
        bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM,
        left: 0, right: 0,
        display: 'flex', alignItems: 'center', gap: SPACE.sm,
        padding: `${SPACE.md}px ${SPACE.base}px`,
        paddingBottom: `max(${SPACE.md}px, env(safe-area-inset-bottom))`,
        background: `linear-gradient(180deg, ${COLORS.bg}00 0%, ${COLORS.bg} 20%)`,
        borderTop: `1px solid ${COLORS.border}`,
        zIndex: Z.modal + 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flex: 1 }}>
          <StatusPill label={`${orders.length} ORDER${orders.length !== 1 ? 'S' : ''}`} tone="warn" pulse />
        </div>
        <TacticalButton
          variant="primary"
          onClick={() => setReviewing(true)}
          icon={<ShieldCheck size={13} />}
        >
          Review & Sign
        </TacticalButton>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="order-entry"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            // Stop above MobileView's bottom HUD nav so app tabs stay visible.
            bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM,
            zIndex: Z.modal,
            background: COLORS.bg,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONTS.sans,
            color: COLORS.textPrimary,
            overflow: 'hidden',
            paddingTop: 'env(safe-area-inset-top)',
            borderTop: `1px solid ${COLORS.borderStrong}`,
          }}
        >
          {/* ── Header strip ──────────────────────────────────────────── */}
          <HudStrip side="top" fixed>
            <button
              onClick={handleClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                background: 'transparent',
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textSecondary,
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
            <BracketLabel tone="accent" size="sm">CPOE &middot; Orders</BracketLabel>
            <div style={{ flex: 1 }} />
            {patientId && <StatusPill label={patientId} tone="info" />}
          </HudStrip>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            paddingTop: 56,
            paddingBottom: orders.length > 0 && !reviewing ? 'max(env(safe-area-inset-bottom), 72px)' : `max(env(safe-area-inset-bottom), ${SPACE.base}px)`,
            WebkitOverflowScrolling: 'touch',
          }}>
            <AnimatePresence mode="wait">
              {reviewing ? (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                >
                  {renderReview()}
                </motion.div>
              ) : (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                >
                  {renderTabs()}
                  {category === 'meds' && renderMeds()}
                  {category === 'labs' && renderLabs()}
                  {category === 'imaging' && renderImaging()}
                  {category === 'consults' && renderConsults()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Order basket footer ───────────────────────────────────── */}
          {renderBasket()}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

OrderEntry.displayName = 'OrderEntry';

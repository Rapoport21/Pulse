import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Activity,
  Pill,
  FileText,
  Scale,
  AlertTriangle,
  Syringe,
  Plus,
  CheckCircle2,
  CreditCard,
  Clock,
  ScanLine,
  ListTodo,
  Droplets,
  Loader2,
  Save,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
  TacticalButton,
  CornerBracket,
  HudStrip,
  DotGridBg,
  Divider,
} from './design';

interface PatientDetailScreenProps {
  patient: any;
  onClose: () => void;
  onSave: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Section — a TacticalCard with a bracketed header row
// ─────────────────────────────────────────────────────────────────────────
const Section: React.FC<{
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, icon: Icon, action, children }) => (
  <TacticalCard padding="none" style={{ marginBottom: SPACE.md }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE.sm,
        padding: `${SPACE.base}px ${SPACE.md}px`,
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surfaceElev,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
        <div
          style={{
            position: 'relative',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.surface,
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: RADIUS.sm,
            color: COLORS.textSecondary,
            flexShrink: 0,
          }}
        >
          <Icon size={12} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <Mono tone="muted" size="xs">
            {id}
          </Mono>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.textPrimary,
              letterSpacing: '-0.003em',
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
        </div>
      </div>
      {action}
    </div>
    <div style={{ padding: SPACE.md }}>{children}</div>
  </TacticalCard>
);

// ─────────────────────────────────────────────────────────────────────────
// Field — tactical labeled input with optional unit
// ─────────────────────────────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  defaultValue?: string;
  type?: string;
  unit?: string;
  placeholder?: string;
}> = ({ label, defaultValue, type = 'text', unit, placeholder }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <BracketLabel tone="muted" size="xs">
        {label}
      </BracketLabel>
      <div style={{ position: 'relative', marginTop: 4 }}>
        <input
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
            paddingRight: unit ? 44 : SPACE.md,
            background: COLORS.bgDeep,
            border: `1px solid ${focused ? COLORS.accent : COLORS.border}`,
            borderRadius: RADIUS.sm,
            color: COLORS.textPrimary,
            fontFamily: FONTS.sans,
            fontSize: 14,
            fontWeight: 500,
            outline: 'none',
            transition: `all ${MOTION.fast}s ease`,
            boxShadow: focused ? `0 0 0 3px ${COLORS.accentGlow}` : 'none',
          }}
        />
        {unit && (
          <Mono
            tone="muted"
            size="xs"
            style={{
              position: 'absolute',
              right: SPACE.md,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            {unit}
          </Mono>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StatBox — a framed label/value readout used in the patient banner
// ─────────────────────────────────────────────────────────────────────────
const StatBox: React.FC<{
  label: string;
  value: string;
  tone?: 'default' | 'crit' | 'warn' | 'info';
}> = ({ label, value, tone = 'default' }) => {
  const color =
    tone === 'crit'
      ? COLORS.crit
      : tone === 'warn'
        ? COLORS.warn
        : tone === 'info'
          ? COLORS.info
          : COLORS.textPrimary;
  const borderColor =
    tone === 'crit'
      ? COLORS.crit
      : tone === 'warn'
        ? COLORS.warn
        : tone === 'info'
          ? COLORS.info
          : COLORS.border;
  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${SPACE.base}px ${SPACE.sm}px`,
        background: tone === 'default' ? COLORS.surface : 'rgba(225,29,72,0.04)',
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <CornerBracket position="tl" color={borderColor} size={4} thickness={1} inset={-1} />
      <CornerBracket position="br" color={borderColor} size={4} thickness={1} inset={-1} />
      <Mono tone="muted" size="xs">
        {label}
      </Mono>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 18,
          fontWeight: 700,
          color,
          letterSpacing: '-0.01em',
          marginTop: 2,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
};

/**
 * PatientDetailScreen — tactical patient chart detail. Full-screen slide-in
 * with HUD strip, patient banner (age/code/acuity), and a sequence of
 * Section cards for Intake, I&O, Clinical Profile, Medications, Nursing
 * Orders, and Admin & Insurance.
 */
export const PatientDetailScreen: React.FC<PatientDetailScreenProps> = ({
  patient,
  onClose,
  onSave,
  showToast,
}) => {
  const [painScore, setPainScore] = useState(4);
  const [isSaving, setIsSaving] = useState(false);
  const [isGuarantorSame, setIsGuarantorSame] = useState(true);
  const [chiefComplaintFocused, setChiefComplaintFocused] = useState(false);
  const [orders, setOrders] = useState([
    {
      id: 'o1',
      task: 'Turn patient q2h',
      time: '15:00',
      status: 'pending',
      type: 'routine',
    },
    {
      id: 'o2',
      task: 'Neuro check q1h',
      time: '15:30',
      status: 'pending',
      type: 'stat',
    },
    {
      id: 'o3',
      task: 'Draw CBC & BMP',
      time: '14:00',
      status: 'completed',
      type: 'routine',
    },
  ]);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      onSave();
      onClose();
    }, 800);
  };

  const isDnr = String(patient?.code || '').includes('DNR');

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.42, ease: MOTION.ease }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: COLORS.bg,
        color: COLORS.textPrimary,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONTS.sans,
        // Honour iPhone safe areas — fixed elements don't inherit
        // padding from the parent shell, so the dynamic island and
        // home indicator would otherwise clip the chrome.
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <DotGridBg />

      {/* Top HUD strip — tactical header with back + save */}
      <HudStrip side="top" fixed={false} height={52}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flex: 1, minWidth: 0 }}>
          {/* Minimal icon-only back button — the old bordered label+icon
              duplicated the "back" affordance with redundant chrome. */}
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Back"
            whileTap={{ scale: 0.9 }}
            whileHover={{ x: -2 }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: COLORS.textSecondary,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </motion.button>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              flex: 1,
            }}
          >
            <BracketLabel tone="secondary" size="xs">
              PATIENT · DETAIL
            </BracketLabel>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: SPACE.sm,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  letterSpacing: '-0.003em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {patient?.name ?? 'Unknown'}
              </span>
              <Mono tone="muted" size="xs">
                {patient?.mrn ?? 'MRN —'}
              </Mono>
            </div>
          </div>
        </div>

        <TacticalButton
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          icon={
            isSaving ? (
              <Loader2
                size={13}
                strokeWidth={2}
                style={{ animation: 'spin 1.2s linear infinite' }}
              />
            ) : (
              <Save size={13} strokeWidth={2} />
            )
          }
        >
          {isSaving ? 'Saving…' : 'Save'}
        </TacticalButton>
      </HudStrip>

      {/* Scrollable main content */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE['3xl']}px`,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {/* Patient banner */}
          <div
            style={{
              display: 'flex',
              gap: SPACE.sm,
              marginBottom: SPACE.lg,
            }}
          >
            <StatBox label="Age / Sex" value={patient?.age ?? '—'} />
            <StatBox
              label="Code Status"
              value={patient?.code ?? '—'}
              tone={isDnr ? 'info' : 'default'}
            />
            <StatBox label="Acuity" value="ESI 2" tone="crit" />
          </div>

          {/* Intake & Measurements */}
          <Section id="PT.INTAKE" title="Intake & Measurements" icon={Scale}>
            <div
              style={{
                display: 'flex',
                gap: SPACE.sm,
                marginBottom: SPACE.md,
                flexWrap: 'wrap',
              }}
            >
              <Field label="Height" defaultValue="178" unit="cm" type="number" />
              <Field label="Weight" defaultValue="82.5" unit="kg" type="number" />
              <div style={{ flex: 1, minWidth: 120 }}>
                <BracketLabel tone="muted" size="xs">
                  BMI
                </BracketLabel>
                <div
                  style={{
                    marginTop: 4,
                    padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                    background: COLORS.bgDeep,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACE.sm,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 14,
                      fontWeight: 700,
                      color: COLORS.warn,
                    }}
                  >
                    26.0
                  </span>
                  <StatusPill label="Overweight" tone="warn" />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: SPACE.md }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.xs,
                  marginBottom: 6,
                }}
              >
                <Activity size={11} strokeWidth={2} color={COLORS.textMuted} />
                <BracketLabel tone="muted" size="xs">
                  PAIN SCALE · 0–10
                </BracketLabel>
              </div>
              <div
                style={{
                  padding: SPACE.md,
                  background: COLORS.bgDeep,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: SPACE.sm,
                  }}
                >
                  <Mono tone="ok" size="xs">
                    0
                  </Mono>
                  <div
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 32,
                      fontWeight: 700,
                      color: COLORS.textPrimary,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1,
                    }}
                  >
                    {painScore}
                  </div>
                  <Mono tone="crit" size="xs">
                    10
                  </Mono>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={painScore}
                  onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    accentColor: COLORS.accent,
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: SPACE.sm,
              }}
            >
              <Field label="Temp" defaultValue="37.2" unit="°C" type="number" />
              <Field label="Resp Rate" defaultValue="18" unit="bpm" type="number" />
            </div>
          </Section>

          {/* I&O */}
          <Section id="PT.IO" title="I&O · Intake / Output" icon={Droplets}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: SPACE.sm,
                marginBottom: SPACE.sm,
              }}
            >
              <IoBlock
                label="Total Intake"
                value="1250"
                unit="mL"
                sub="PO: 250mL · IV: 1000mL"
                color={COLORS.info}
              />
              <IoBlock
                label="Total Output"
                value="800"
                unit="mL"
                sub="Void: 800mL"
                color={COLORS.warn}
              />
            </div>
            <div style={{ display: 'flex', gap: SPACE.sm }}>
              <TacticalButton
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => showToast('Add Intake dialog opened', 'info')}
                icon={<Plus size={12} strokeWidth={2} />}
              >
                Add Intake
              </TacticalButton>
              <TacticalButton
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => showToast('Add Output dialog opened', 'info')}
                icon={<Plus size={12} strokeWidth={2} />}
              >
                Add Output
              </TacticalButton>
            </div>
          </Section>

          {/* Clinical Profile */}
          <Section id="PT.CLINICAL" title="Clinical Profile" icon={FileText}>
            <div style={{ marginBottom: SPACE.md }}>
              <BracketLabel tone="muted" size="xs">
                CHIEF COMPLAINT
              </BracketLabel>
              <textarea
                defaultValue={patient?.notes ?? ''}
                onFocus={() => setChiefComplaintFocused(true)}
                onBlur={() => setChiefComplaintFocused(false)}
                style={{
                  width: '100%',
                  marginTop: 4,
                  minHeight: 84,
                  padding: SPACE.md,
                  background: COLORS.bgDeep,
                  border: `1px solid ${chiefComplaintFocused ? COLORS.accent : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textPrimary,
                  fontFamily: FONTS.sans,
                  fontSize: 13,
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical',
                  boxShadow: chiefComplaintFocused
                    ? `0 0 0 3px ${COLORS.accentGlow}`
                    : 'none',
                  transition: `all ${MOTION.fast}s ease`,
                }}
              />
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: SPACE.xs + 2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} strokeWidth={2} color={COLORS.crit} />
                  <BracketLabel tone="muted" size="xs">
                    ALLERGIES
                  </BracketLabel>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Add Allergy dialog opened', 'info')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    background: 'transparent',
                    border: 'none',
                    color: COLORS.textSecondary,
                    cursor: 'pointer',
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                  }}
                >
                  <Plus size={11} strokeWidth={2} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <AllergyChip label="Penicillin" critical />
                <AllergyChip label="Latex" />
              </div>
            </div>
          </Section>

          {/* Medications (MAR) */}
          <Section
            id="PT.MAR"
            title="Medications · MAR"
            icon={Pill}
            action={
              <TacticalButton
                variant="ghost"
                size="sm"
                onClick={() => showToast('Barcode Scanner Activated', 'info')}
                icon={<ScanLine size={12} strokeWidth={2} />}
              >
                Scan to Admin
              </TacticalButton>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
              <MedRow
                icon={<CheckCircle2 size={14} color={COLORS.ok} strokeWidth={2} />}
                title="Ondansetron (Zofran)"
                sub="4mg IV Push · Given 14:30"
                status="given"
              />
              <MedRow
                icon={<Syringe size={14} color={COLORS.textSecondary} strokeWidth={2} />}
                title="Morphine Sulfate"
                sub="2mg IV Push · Due 16:00"
                action={
                  <TacticalButton
                    variant="primary"
                    size="sm"
                    onClick={() => showToast('Medication administered', 'success')}
                  >
                    Administer
                  </TacticalButton>
                }
              />
            </div>
          </Section>

          {/* Nursing Orders */}
          <Section id="PT.ORDERS" title="Nursing Orders" icon={ListTodo}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
              {orders.map((order) => {
                const completed = order.status === 'completed';
                const isStat = order.type === 'stat';
                return (
                  <div
                    key={order.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: SPACE.sm,
                      padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                      background: completed ? 'rgba(16,185,129,0.04)' : COLORS.bgDeep,
                      border: `1px solid ${completed ? COLORS.ok : isStat ? COLORS.crit : COLORS.border}`,
                      borderLeft: `3px solid ${completed ? COLORS.ok : isStat ? COLORS.crit : COLORS.border}`,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setOrders((prev) =>
                            prev.map((o) =>
                              o.id === order.id
                                ? {
                                    ...o,
                                    status:
                                      o.status === 'completed' ? 'pending' : 'completed',
                                  }
                                : o,
                            ),
                          );
                          showToast(
                            `Order marked as ${completed ? 'pending' : 'completed'}`,
                            'success',
                          );
                        }}
                        style={{
                          width: 18,
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: completed ? COLORS.ok : COLORS.surface,
                          border: `1px solid ${completed ? COLORS.ok : COLORS.borderStrong}`,
                          borderRadius: RADIUS.sm,
                          cursor: 'pointer',
                          flexShrink: 0,
                          color: '#000',
                          transition: `all ${MOTION.fast}s ease`,
                        }}
                      >
                        {completed && <CheckCircle2 size={11} strokeWidth={2.5} />}
                      </button>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 13,
                            fontWeight: 500,
                            color: completed ? COLORS.textMuted : COLORS.textPrimary,
                            textDecoration: completed ? 'line-through' : 'none',
                            lineHeight: 1.3,
                          }}
                        >
                          {order.task}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          <Clock size={10} strokeWidth={2} color={COLORS.textDim} />
                          <Mono tone="dim" size="xs">
                            Due {order.time}
                          </Mono>
                        </div>
                      </div>
                    </div>
                    {isStat && !completed && (
                      <StatusPill label="STAT" tone="crit" pulse />
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Admin & Insurance */}
          <Section id="PT.ADMIN" title="Admin & Insurance" icon={CreditCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
              <Field label="Primary Insurance" defaultValue="BlueCross BlueShield" />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: SPACE.sm,
                }}
              >
                <Field label="Member ID" defaultValue="XYZ123456789" />
                <Field label="Group Number" defaultValue="98765" />
              </div>
              <Divider />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <Mono tone="muted" size="xs">
                    TOGGLE
                  </Mono>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 13,
                      color: COLORS.textPrimary,
                      marginTop: 2,
                    }}
                  >
                    Guarantor same as patient
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGuarantorSame(!isGuarantorSame)}
                  role="switch"
                  aria-checked={isGuarantorSame}
                  style={{
                    position: 'relative',
                    width: 42,
                    height: 22,
                    background: isGuarantorSame ? COLORS.ok : COLORS.surfaceElev,
                    border: `1px solid ${isGuarantorSame ? COLORS.ok : COLORS.borderStrong}`,
                    borderRadius: 999,
                    cursor: 'pointer',
                    transition: `all ${MOTION.fast}s ease`,
                    padding: 0,
                  }}
                >
                  <motion.div
                    animate={{ x: isGuarantorSame ? 20 : 2 }}
                    transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                    style={{
                      position: 'absolute',
                      top: 2,
                      width: 16,
                      height: 16,
                      background: isGuarantorSame ? '#000' : COLORS.textPrimary,
                      borderRadius: '50%',
                    }}
                  />
                </button>
              </div>
            </div>
          </Section>
        </div>
      </main>

      <style>
        {`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}
      </style>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// IoBlock — intake/output summary cell
// ─────────────────────────────────────────────────────────────────────────
const IoBlock: React.FC<{
  label: string;
  value: string;
  unit: string;
  sub: string;
  color: string;
}> = ({ label, value, unit, sub, color }) => (
  <div
    style={{
      position: 'relative',
      padding: SPACE.md,
      background: COLORS.bgDeep,
      border: `1px solid ${color}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: RADIUS.sm,
    }}
  >
    <Mono tone="muted" size="xs" style={{ color }}>
      {label}
    </Mono>
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        marginTop: 4,
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 24,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 11,
          color,
          opacity: 0.6,
        }}
      >
        {unit}
      </span>
    </div>
    <Mono tone="dim" size="xs" style={{ marginTop: 4 }}>
      {sub}
    </Mono>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// AllergyChip — critical (rose) or neutral chip
// ─────────────────────────────────────────────────────────────────────────
const AllergyChip: React.FC<{ label: string; critical?: boolean }> = ({
  label,
  critical,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      background: critical ? 'rgba(225,29,72,0.08)' : COLORS.bgDeep,
      border: `1px solid ${critical ? COLORS.accent : COLORS.border}`,
      borderRadius: RADIUS.sm,
      fontFamily: FONTS.sans,
      fontSize: 12,
      fontWeight: 600,
      color: critical ? COLORS.accent : COLORS.textSecondary,
      boxShadow: critical ? `0 0 12px ${COLORS.accentGlow}` : 'none',
    }}
  >
    {label}
    {critical && (
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: COLORS.accent,
          animation: 'pulse-dot 1.4s ease-in-out infinite',
        }}
      />
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// MedRow — single medication line item
// ─────────────────────────────────────────────────────────────────────────
const MedRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  sub: string;
  status?: 'given' | 'due';
  action?: React.ReactNode;
}> = ({ icon, title, sub, status, action }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACE.sm,
      padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
      background: status === 'given' ? 'rgba(16,185,129,0.04)' : COLORS.bgDeep,
      border: `1px solid ${status === 'given' ? COLORS.ok : COLORS.border}`,
      borderLeft: `3px solid ${status === 'given' ? COLORS.ok : COLORS.borderStrong}`,
      borderRadius: RADIUS.sm,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
      <div
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.surface,
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: RADIUS.sm,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.textPrimary,
            lineHeight: 1.25,
          }}
        >
          {title}
        </div>
        <Mono tone="muted" size="xs">
          {sub}
        </Mono>
      </div>
    </div>
    {action}
  </div>
);

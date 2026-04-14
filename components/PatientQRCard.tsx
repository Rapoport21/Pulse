import React, { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import type { Patient } from '../types';
import { ageInYears } from '../data/clinicalMock';
import { FONTS } from './design';

/**
 * PatientQRCard — a printable patient wristband / ID card.
 *
 * Renders as a single vertical card sized for home-printing on
 * Letter/A4 paper (one-up) or for export as a laminated wristband.
 * Black-on-white for maximum scan reliability and copier friendliness.
 *
 * The QR payload format is:
 *   pulse://patient/<id>?mrn=<mrn>&name=<encoded>
 *
 * The scanner side parses this into a navigation intent that opens the
 * corresponding patient detail screen. The MRN + name are included as
 * query params so a receiving device without the patient in its local
 * store can still surface a useful toast.
 *
 * Visual style is deliberately black-and-white with sharp corner
 * brackets (printed as 1px borders) + mono labels. It looks at home on
 * a print-out and still reads as PULSE-family design.
 */

export interface PatientQRCardProps {
  patient: Patient;
  /** Include a dashed cut-line at the bottom for easy wristband trimming. */
  cutLine?: boolean;
}

export const PATIENT_QR_PREFIX = 'pulse://patient/';

/** Encode a Patient into the QR payload string. */
export const patientQRPayload = (patient: Patient): string => {
  const name = `${patient.name.given} ${patient.name.family}`;
  const params = new URLSearchParams({
    mrn: patient.mrn,
    name,
  });
  return `${PATIENT_QR_PREFIX}${patient.id}?${params.toString()}`;
};

export const PatientQRCard: React.FC<PatientQRCardProps> = ({
  patient,
  cutLine = false,
}) => {
  const payload = useMemo(() => patientQRPayload(patient), [patient]);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 720, // upscaled so the printed code stays crisp at any size
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (alive) setError(msg);
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  const enc = patient.currentEncounter;
  const age = ageInYears(patient.birthDate);
  const dob = new Date(patient.birthDate).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
  const fullName = `${patient.name.family.toUpperCase()}, ${patient.name.given}${
    patient.name.preferred ? ` (${patient.name.preferred})` : ''
  }`;
  const location = enc?.location?.bed
    ? `${enc.location.zone ?? ''} · ${enc.location.bed}`.trim()
    : enc?.location?.zone ?? 'UNASSIGNED';
  const criticalAllergies = patient.allergies.filter(
    (a) => a.severity === 'high',
  );
  const showAllergyStrip = criticalAllergies.length > 0;
  const esi = enc?.esi;
  const generatedAt = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Rendering: a single flex-column card, 100% width of the parent.
  // All typography is black-on-white, uppercase-mono for labels and
  // sans for data. Corner brackets are 1-px borders drawn with CSS.
  return (
    <div
      data-print-patient-qr-card
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 360,
        margin: '0 auto',
        padding: '18px 20px 16px',
        background: '#FFFFFF',
        color: '#000000',
        fontFamily: FONTS.sans,
        border: '2px solid #000000',
        // tactile corner accents — thick L-brackets drawn as box-shadow insets
        boxShadow: 'inset 0 0 0 0 #000, 0 0 0 0 rgba(0,0,0,0)',
      }}
    >
      {/* ── Corner brackets (printed L marks) ────────────────── */}
      <CornerMark position="tl" />
      <CornerMark position="tr" />
      <CornerMark position="bl" />
      <CornerMark position="br" />

      {/* ── Header row: logo mark + system label ───────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 8,
          borderBottom: '1px solid #000000',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#000000',
            }}
          >
            PULSE
          </span>
          <span style={monoLabel}>PATIENT · ID BAND</span>
        </div>
        <span style={monoLabel}>{patient.id}</span>
      </div>

      {/* ── QR code plate ─────────────────────────────────────── */}
      <div
        style={{
          margin: '12px auto',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
          padding: 4,
        }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Patient QR"
            width={220}
            height={220}
            style={{
              display: 'block',
              width: 220,
              height: 220,
              imageRendering: 'pixelated',
            }}
          />
        ) : error ? (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: '#B91C1C',
              padding: 24,
              textAlign: 'center',
            }}
          >
            QR ENCODE ERROR: {error}
          </div>
        ) : (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: '#6B7280',
              padding: 24,
            }}
          >
            ENCODING…
          </div>
        )}
      </div>

      {/* ── Patient name + demographics ───────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            color: '#000000',
          }}
        >
          {fullName}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: FONTS.mono,
            fontSize: 11,
            letterSpacing: '0.08em',
            color: '#000000',
          }}
        >
          DOB {dob} · {age}Y · {sexShort(patient.sex)}
        </div>
      </div>

      {/* ── MRN barcode-lookalike strip ───────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 10px',
          marginBottom: 8,
          background: '#000000',
          color: '#FFFFFF',
          fontFamily: FONTS.mono,
          fontSize: 11,
          letterSpacing: '0.12em',
        }}
      >
        <span>MRN</span>
        <span style={{ fontWeight: 600 }}>{patient.mrn}</span>
      </div>

      {/* ── Status grid — ESI, Location, Code Status ──────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: esi ? '1fr 1fr 1fr' : '1fr 1fr',
          gap: 6,
          marginBottom: 8,
        }}
      >
        {esi && (
          <StatusCell
            label="ESI"
            value={`${esi}`}
            emphasis={esi <= 2 ? 'critical' : esi === 3 ? 'warn' : 'plain'}
          />
        )}
        <StatusCell label="LOCATION" value={location} />
        <StatusCell
          label="CODE"
          value={patient.codeStatus}
          emphasis={patient.codeStatus === 'FULL' ? 'plain' : 'warn'}
        />
      </div>

      {/* ── Critical allergy strip (only if high-severity exists) ── */}
      {showAllergyStrip && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            marginBottom: 8,
            border: '2px solid #000000',
            background: '#FFFFFF',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              padding: '2px 6px',
              background: '#000000',
              color: '#FFFFFF',
              fontFamily: FONTS.mono,
              fontSize: 10,
              letterSpacing: '0.14em',
              fontWeight: 700,
            }}
          >
            ! ALLERGY
          </span>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              fontWeight: 600,
              color: '#000000',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {criticalAllergies.map((a) => a.substance).join(', ')}
          </span>
        </div>
      )}

      {/* ── Chief complaint (if present) ──────────────────────── */}
      {enc?.chiefComplaint && (
        <div style={{ marginBottom: 8 }}>
          <div style={monoLabel}>CHIEF COMPLAINT</div>
          <div
            style={{
              marginTop: 2,
              fontFamily: FONTS.sans,
              fontSize: 12,
              lineHeight: 1.35,
              color: '#000000',
            }}
          >
            {enc.chiefComplaint}
          </div>
        </div>
      )}

      {/* ── Footer: payload debug + timestamp ─────────────────── */}
      <div
        style={{
          paddingTop: 8,
          borderTop: '1px dashed #000000',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ ...monoLabel, fontSize: 9 }}>{generatedAt}</span>
        <span style={{ ...monoLabel, fontSize: 9 }}>PULSE · CONFIDENTIAL</span>
      </div>

      {cutLine && (
        <div
          aria-hidden
          style={{
            marginTop: 16,
            borderTop: '1px dashed #000000',
            paddingTop: 4,
            textAlign: 'center',
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: '#000000',
          }}
        >
          ✂ CUT ALONG LINE
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────

const monoLabel: React.CSSProperties = {
  fontFamily: FONTS.mono,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#000000',
};

const sexShort = (sex: Patient['sex']): string => {
  switch (sex) {
    case 'M':
      return 'M';
    case 'F':
      return 'F';
    case 'X':
      return 'X';
    case 'U':
    default:
      return 'U';
  }
};

const CornerMark: React.FC<{ position: 'tl' | 'tr' | 'bl' | 'br' }> = ({
  position,
}) => {
  const [v, h] = position.split('') as Array<'t' | 'b' | 'l' | 'r'>;
  const size = 10;
  const offset = -2;
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        width: size,
        height: size,
        [v === 't' ? 'top' : 'bottom']: offset,
        [h === 'l' ? 'left' : 'right']: offset,
        borderTop: v === 't' ? '2px solid #000' : undefined,
        borderBottom: v === 'b' ? '2px solid #000' : undefined,
        borderLeft: h === 'l' ? '2px solid #000' : undefined,
        borderRight: h === 'r' ? '2px solid #000' : undefined,
      }}
    />
  );
};

const StatusCell: React.FC<{
  label: string;
  value: string;
  emphasis?: 'plain' | 'warn' | 'critical';
}> = ({ label, value, emphasis = 'plain' }) => {
  const isCritical = emphasis === 'critical';
  const isWarn = emphasis === 'warn';
  return (
    <div
      style={{
        padding: '6px 8px',
        border: '1px solid #000000',
        background: isCritical ? '#000000' : '#FFFFFF',
        color: isCritical ? '#FFFFFF' : '#000000',
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: isCritical ? '#FFFFFF' : '#000000',
          opacity: isCritical ? 0.7 : 0.6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 2,
          fontFamily: FONTS.sans,
          fontSize: 13,
          fontWeight: isWarn || isCritical ? 700 : 600,
          letterSpacing: '-0.005em',
          color: isCritical ? '#FFFFFF' : '#000000',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
};

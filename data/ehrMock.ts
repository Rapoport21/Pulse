/**
 * EHR mock data — lab results, clinical notes, imaging orders,
 * and additional medication orders for the patient chart.
 *
 * Organized per-patient so PatientDetailScreen can look up by ID.
 * Values are hand-tuned to tell clinical stories that match each
 * patient's condition in clinicalMock.ts.
 */

import type {
  LabResult,
  ClinicalNote,
  MedicationOrder,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const minutesAgo = (mins: number): string => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - mins);
  return d.toISOString();
};

const hoursAgo = (hours: number): string => minutesAgo(hours * 60);

// ─────────────────────────────────────────────────────────────────────────
// Lab Results
// ─────────────────────────────────────────────────────────────────────────

const traumaLabs: LabResult[] = [
  { id: 'L001', patientId: 'P001', name: 'Hemoglobin', loincCode: '718-7', value: 8.2, unit: 'g/dL', referenceLow: 13.5, referenceHigh: 17.5, flag: 'LL', collectedAt: hoursAgo(1), resultedAt: minutesAgo(40), status: 'final' },
  { id: 'L002', patientId: 'P001', name: 'Hematocrit', loincCode: '4544-3', value: 24.8, unit: '%', referenceLow: 38.3, referenceHigh: 48.6, flag: 'LL', collectedAt: hoursAgo(1), resultedAt: minutesAgo(40), status: 'final' },
  { id: 'L003', patientId: 'P001', name: 'Lactate', loincCode: '2524-7', value: 4.8, unit: 'mmol/L', referenceLow: 0.5, referenceHigh: 2.2, flag: 'HH', collectedAt: minutesAgo(30), resultedAt: minutesAgo(15), status: 'final' },
  { id: 'L004', patientId: 'P001', name: 'INR', loincCode: '6301-6', value: 1.1, unit: '', referenceLow: 0.8, referenceHigh: 1.2, flag: 'N', collectedAt: hoursAgo(1), resultedAt: minutesAgo(40), status: 'final' },
  { id: 'L005', patientId: 'P001', name: 'Type & Screen', loincCode: '882-1', value: 'A+', unit: '', collectedAt: hoursAgo(1), resultedAt: minutesAgo(45), status: 'final' },
  { id: 'L006', patientId: 'P001', name: 'BMP (Pending)', loincCode: '51990-0', value: 'Pending', unit: '', collectedAt: minutesAgo(10), resultedAt: minutesAgo(10), status: 'preliminary' },
];

const chestPainLabs: LabResult[] = [
  { id: 'L010', patientId: 'P002', name: 'Troponin I', loincCode: '10839-9', value: 2.4, unit: 'ng/mL', referenceLow: 0, referenceHigh: 0.04, flag: 'HH', collectedAt: hoursAgo(2), resultedAt: hoursAgo(1.5), status: 'final' },
  { id: 'L011', patientId: 'P002', name: 'Troponin I (repeat)', loincCode: '10839-9', value: 3.1, unit: 'ng/mL', referenceLow: 0, referenceHigh: 0.04, flag: 'HH', collectedAt: minutesAgo(30), resultedAt: minutesAgo(12), status: 'final' },
  { id: 'L012', patientId: 'P002', name: 'BNP', loincCode: '30934-4', value: 890, unit: 'pg/mL', referenceLow: 0, referenceHigh: 100, flag: 'HH', collectedAt: hoursAgo(2), resultedAt: hoursAgo(1.5), status: 'final' },
  { id: 'L013', patientId: 'P002', name: 'Creatinine', loincCode: '2160-0', value: 1.8, unit: 'mg/dL', referenceLow: 0.6, referenceHigh: 1.2, flag: 'H', collectedAt: hoursAgo(2), resultedAt: hoursAgo(1.5), status: 'final' },
  { id: 'L014', patientId: 'P002', name: 'Potassium', loincCode: '6298-4', value: 4.2, unit: 'mEq/L', referenceLow: 3.5, referenceHigh: 5.0, flag: 'N', collectedAt: hoursAgo(2), resultedAt: hoursAgo(1.5), status: 'final' },
];

const sepsisLabs: LabResult[] = [
  { id: 'L020', patientId: 'P005', name: 'Lactate', loincCode: '2524-7', value: 3.6, unit: 'mmol/L', referenceLow: 0.5, referenceHigh: 2.2, flag: 'HH', collectedAt: minutesAgo(45), resultedAt: minutesAgo(20), status: 'final' },
  { id: 'L021', patientId: 'P005', name: 'WBC', loincCode: '6690-2', value: 18.4, unit: 'K/uL', referenceLow: 4.5, referenceHigh: 11.0, flag: 'HH', collectedAt: hoursAgo(2), resultedAt: hoursAgo(1), status: 'final' },
  { id: 'L022', patientId: 'P005', name: 'Procalcitonin', loincCode: '33959-8', value: 8.2, unit: 'ng/mL', referenceLow: 0, referenceHigh: 0.5, flag: 'HH', collectedAt: hoursAgo(2), resultedAt: hoursAgo(1), status: 'final' },
  { id: 'L023', patientId: 'P005', name: 'Creatinine', loincCode: '2160-0', value: 2.4, unit: 'mg/dL', referenceLow: 0.6, referenceHigh: 1.2, flag: 'HH', collectedAt: hoursAgo(2), resultedAt: hoursAgo(1), status: 'final' },
  { id: 'L024', patientId: 'P005', name: 'Blood Culture', loincCode: '600-7', value: 'Pending', unit: '', collectedAt: hoursAgo(3), resultedAt: hoursAgo(3), status: 'preliminary' },
  { id: 'L025', patientId: 'P005', name: 'Urinalysis', loincCode: '5767-9', value: 'Positive', unit: '', collectedAt: hoursAgo(4), resultedAt: hoursAgo(3), status: 'final', flag: 'H' },
];

export const MOCK_LABS: Record<string, LabResult[]> = {
  P001: traumaLabs,
  P002: chestPainLabs,
  P003: [],
  P004: [],
  P005: sepsisLabs,
};

// ─────────────────────────────────────────────────────────────────────────
// Clinical Notes
// ─────────────────────────────────────────────────────────────────────────

const traumaNotes: ClinicalNote[] = [
  {
    id: 'N001', patientId: 'P001', type: 'H&P',
    authorId: 'DR-ROSTOVA', createdAt: hoursAgo(1.5), signed: true, signedAt: hoursAgo(1),
    content: `**Chief Complaint:** MVA, unrestrained driver, high-speed collision.\n\n**HPI:** 45M brought by EMS s/p MVC. GCS 13 in field, deformed L femur, abd tenderness. TXA administered in field. Two 18g IVs established.\n\n**Physical Exam:**\n- General: Alert, diaphoretic, tachycardic\n- HEENT: 3cm laceration L temporal\n- Chest: Clear bilaterally\n- Abdomen: Tender LUQ, guarding\n- Extremities: Deformed L femur, distal pulses intact\n\n**Assessment/Plan:**\n1. Hemorrhagic shock — 2U pRBC ordered, repeat CBC/Lactate\n2. Suspected splenic laceration — CT abdomen/pelvis with contrast\n3. L femur fracture — ortho consult, splint in place\n4. Admit to trauma service`,
  },
  {
    id: 'N002', patientId: 'P001', type: 'NURSING',
    authorId: 'RN-CHEN', createdAt: minutesAgo(30), signed: true, signedAt: minutesAgo(28),
    content: `**Nursing Assessment:** Patient hemodynamically unstable. 2nd unit pRBC infusing. Pain 9/10. Morphine 2mg IV given with moderate effect. Neuro checks q1h — GCS stable at 13. Family at bedside, updated on plan. Fall precautions in place.`,
  },
];

const chestPainNotes: ClinicalNote[] = [
  {
    id: 'N010', patientId: 'P002', type: 'SOAP',
    authorId: 'DR-PARK', createdAt: hoursAgo(2), signed: true, signedAt: hoursAgo(1.5),
    content: `**S:** 62F with hx of AFib, HTN, CKD3 presenting with substernal chest pain radiating to L arm, onset 2h PTA. Pain 7/10, pressure-like, not relieved by rest. Denies SOB, diaphoresis, N/V.\n\n**O:** Vitals stable, mild tachy HR 98, BP 145/90. ECG: NSR, no acute ST changes. Trop I 2.4 (elevated).\n\n**A:** NSTEMI. Troponin trending up (2.4 → 3.1). BNP 890 suggests volume overload.\n\n**P:**\n1. Cardiology consult — stat\n2. Heparin drip per ACS protocol\n3. Serial troponins q6h\n4. Echocardiogram in AM\n5. Hold metformin (Cr 1.8)`,
  },
];

const sepsisNotes: ClinicalNote[] = [
  {
    id: 'N020', patientId: 'P005', type: 'PROGRESS',
    authorId: 'DR-JENSEN', createdAt: hoursAgo(4), signed: true, signedAt: hoursAgo(3.5),
    content: `**Progress Note:** 71M with DM2, HFrEF, CAD, COPD admitted 36h ago with fever, chills, flank pain. UA positive, blood cultures pending. Started on ceftriaxone empirically. Overnight: temp spiked to 39.4°C, BP trending down to 90/56, RR 28. Lactate 3.6 (was 2.1 yesterday).\n\n**Assessment:** Worsening sepsis, likely urosepsis. qSOFA ≥2.\n\n**Plan:**\n1. Broaden antibiotics — add vancomycin\n2. 30 mL/kg crystalloid bolus\n3. Repeat lactate in 2h\n4. If MAP <65 after fluids → start norepinephrine\n5. ICU consult for potential transfer`,
  },
];

export const MOCK_NOTES: Record<string, ClinicalNote[]> = {
  P001: traumaNotes,
  P002: chestPainNotes,
  P003: [],
  P004: [],
  P005: sepsisNotes,
};

// ─────────────────────────────────────────────────────────────────────────
// Medication Orders (expanded beyond the 2 inline meds)
// ─────────────────────────────────────────────────────────────────────────

const traumaMeds: MedicationOrder[] = [
  { id: 'M001', patientId: 'P001', medication: 'Morphine Sulfate', dose: '2 mg', route: 'IV', frequency: 'q4h PRN pain', indication: 'Pain management', orderedAt: hoursAgo(1.5), orderedBy: 'DR-ROSTOVA', status: 'active' },
  { id: 'M002', patientId: 'P001', medication: 'Ondansetron (Zofran)', dose: '4 mg', route: 'IV', frequency: 'q6h PRN nausea', orderedAt: hoursAgo(1.5), orderedBy: 'DR-ROSTOVA', status: 'active' },
  { id: 'M003', patientId: 'P001', medication: 'Tranexamic Acid (TXA)', dose: '1 g', route: 'IV', frequency: 'x1 dose (given in field)', orderedAt: hoursAgo(2), orderedBy: 'EMS', status: 'completed' },
  { id: 'M004', patientId: 'P001', medication: 'Packed RBCs', dose: '2 units', route: 'IV', frequency: 'x1', indication: 'Hemorrhagic shock', orderedAt: hoursAgo(1), orderedBy: 'DR-ROSTOVA', status: 'active', priorityHigh: true },
  { id: 'M005', patientId: 'P001', medication: 'Normal Saline', dose: '1000 mL', route: 'IV', frequency: 'Bolus then 125 mL/hr', orderedAt: hoursAgo(2), orderedBy: 'DR-ROSTOVA', status: 'active' },
  { id: 'M006', patientId: 'P001', medication: 'Tetanus/Diphtheria', dose: '0.5 mL', route: 'IM', frequency: 'x1', orderedAt: hoursAgo(1), orderedBy: 'DR-ROSTOVA', status: 'active' },
];

const chestPainMeds: MedicationOrder[] = [
  { id: 'M010', patientId: 'P002', medication: 'Heparin', dose: '5000 units bolus then 1000 units/hr', route: 'IV', frequency: 'Continuous', indication: 'ACS protocol', orderedAt: hoursAgo(2), orderedBy: 'DR-PARK', status: 'active', priorityHigh: true },
  { id: 'M011', patientId: 'P002', medication: 'Aspirin', dose: '325 mg', route: 'PO', frequency: 'x1 loading', orderedAt: hoursAgo(2.5), orderedBy: 'DR-PARK', status: 'completed' },
  { id: 'M012', patientId: 'P002', medication: 'Ticagrelor (Brilinta)', dose: '180 mg', route: 'PO', frequency: 'x1 loading', orderedAt: hoursAgo(2), orderedBy: 'DR-PARK', status: 'active' },
  { id: 'M013', patientId: 'P002', medication: 'Nitroglycerin', dose: '0.4 mg', route: 'SL', frequency: 'q5min x 3 PRN chest pain', orderedAt: hoursAgo(2.5), orderedBy: 'DR-PARK', status: 'active' },
  { id: 'M014', patientId: 'P002', medication: 'Metoprolol', dose: '25 mg', route: 'PO', frequency: 'BID', indication: 'Rate control', orderedAt: hoursAgo(2), orderedBy: 'DR-PARK', status: 'active' },
];

const sepsisMeds: MedicationOrder[] = [
  { id: 'M020', patientId: 'P005', medication: 'Ceftriaxone', dose: '2 g', route: 'IV', frequency: 'q24h', indication: 'Empiric UTI coverage', orderedAt: hoursAgo(30), orderedBy: 'DR-JENSEN', status: 'active' },
  { id: 'M021', patientId: 'P005', medication: 'Vancomycin', dose: '1.5 g', route: 'IV', frequency: 'q12h', indication: 'Broadened for sepsis', orderedAt: hoursAgo(4), orderedBy: 'DR-JENSEN', status: 'active', priorityHigh: true },
  { id: 'M022', patientId: 'P005', medication: 'Normal Saline', dose: '30 mL/kg', route: 'IV', frequency: 'Bolus (2400 mL)', indication: 'Sepsis fluid resuscitation', orderedAt: hoursAgo(4), orderedBy: 'DR-JENSEN', status: 'active' },
  { id: 'M023', patientId: 'P005', medication: 'Norepinephrine', dose: '0.05 mcg/kg/min', route: 'IV', frequency: 'Continuous, titrate to MAP ≥65', indication: 'Vasopressor', orderedAt: hoursAgo(2), orderedBy: 'DR-JENSEN', status: 'active', priorityHigh: true },
  { id: 'M024', patientId: 'P005', medication: 'Insulin (Regular)', dose: 'Sliding scale', route: 'SC', frequency: 'q6h with meals', indication: 'DM2 management', orderedAt: hoursAgo(30), orderedBy: 'DR-JENSEN', status: 'active' },
];

export const MOCK_MEDS: Record<string, MedicationOrder[]> = {
  P001: traumaMeds,
  P002: chestPainMeds,
  P003: [],
  P004: [],
  P005: sepsisMeds,
};

// ─────────────────────────────────────────────────────────────────────────
// Imaging Orders
// ─────────────────────────────────────────────────────────────────────────

export interface ImagingOrder {
  id: string;
  patientId: string;
  study: string;
  modality: 'XR' | 'CT' | 'MRI' | 'US' | 'ECHO';
  status: 'ordered' | 'in-progress' | 'resulted' | 'cancelled';
  priority: 'stat' | 'routine' | 'urgent';
  orderedAt: string;
  orderedBy: string;
  resultSummary?: string;
  resultedAt?: string;
}

const traumaImaging: ImagingOrder[] = [
  { id: 'I001', patientId: 'P001', study: 'CT Abdomen/Pelvis with Contrast', modality: 'CT', status: 'resulted', priority: 'stat', orderedAt: hoursAgo(1.5), orderedBy: 'DR-ROSTOVA', resultSummary: 'Grade III splenic laceration with active extravasation. Moderate hemoperitoneum. No other solid organ injury.', resultedAt: minutesAgo(50) },
  { id: 'I002', patientId: 'P001', study: 'XR Left Femur AP/Lat', modality: 'XR', status: 'resulted', priority: 'stat', orderedAt: hoursAgo(1.5), orderedBy: 'DR-ROSTOVA', resultSummary: 'Comminuted mid-shaft femur fracture. No vascular compromise.', resultedAt: hoursAgo(1) },
  { id: 'I003', patientId: 'P001', study: 'FAST Ultrasound', modality: 'US', status: 'resulted', priority: 'stat', orderedAt: hoursAgo(2), orderedBy: 'DR-ROSTOVA', resultSummary: 'Positive for free fluid in Morison pouch and splenorenal recess.', resultedAt: hoursAgo(1.8) },
  { id: 'I004', patientId: 'P001', study: 'CT Head without Contrast', modality: 'CT', status: 'in-progress', priority: 'stat', orderedAt: minutesAgo(15), orderedBy: 'DR-ROSTOVA' },
];

const chestPainImaging: ImagingOrder[] = [
  { id: 'I010', patientId: 'P002', study: 'CXR PA/Lat', modality: 'XR', status: 'resulted', priority: 'stat', orderedAt: hoursAgo(2.5), orderedBy: 'DR-PARK', resultSummary: 'Mild cardiomegaly. Bilateral small pleural effusions. No acute infiltrate.', resultedAt: hoursAgo(2) },
  { id: 'I011', patientId: 'P002', study: 'Echocardiogram', modality: 'ECHO', status: 'ordered', priority: 'urgent', orderedAt: minutesAgo(20), orderedBy: 'DR-PARK' },
];

const sepsisImaging: ImagingOrder[] = [
  { id: 'I020', patientId: 'P005', study: 'CT Abdomen/Pelvis with Contrast', modality: 'CT', status: 'resulted', priority: 'urgent', orderedAt: hoursAgo(6), orderedBy: 'DR-JENSEN', resultSummary: 'Left renal pelvis distension with perinephric stranding. Consistent with pyelonephritis. No abscess.', resultedAt: hoursAgo(5) },
  { id: 'I021', patientId: 'P005', study: 'CXR Portable AP', modality: 'XR', status: 'resulted', priority: 'routine', orderedAt: hoursAgo(8), orderedBy: 'DR-JENSEN', resultSummary: 'Stable cardiomegaly. No acute process. Central line in good position.', resultedAt: hoursAgo(7) },
];

export const MOCK_IMAGING: Record<string, ImagingOrder[]> = {
  P001: traumaImaging,
  P002: chestPainImaging,
  P003: [],
  P004: [],
  P005: sepsisImaging,
};

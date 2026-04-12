/**
 * PULSE Clinical Components
 *
 * Single entry point for clinical surface components — the patient
 * banner, vitals panel, and whatever else lands as Wave A expands.
 * Import from here so the consuming screens don't care about internal
 * file layout:
 *
 *   import { PatientHeaderStrip, VitalsPanel } from './clinical';
 */

export { PatientHeaderStrip } from './PatientHeaderStrip';
export type { PatientHeaderStripProps } from './PatientHeaderStrip';
export { VitalsPanel } from './VitalsPanel';
export type { VitalsPanelProps } from './VitalsPanel';
export { ESITriageScreen } from './ESITriageScreen';
export type { ESITriageScreenProps, TriageResult } from './ESITriageScreen';
export { EmsInboundBoard } from './EmsInboundBoard';
export type { EmsInboundBoardProps } from './EmsInboundBoard';
export { BedBoard } from './BedBoard';
export type { BedBoardProps } from './BedBoard';

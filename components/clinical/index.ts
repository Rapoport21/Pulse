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
export { AdmitFlow, INITIAL_ADMISSION_QUEUE } from './AdmitFlow';
export type { AdmitFlowProps, AdmissionEntry, AdmissionSource, AdmissionStatus } from './AdmitFlow';
export { DischargeFlow } from './DischargeFlow';
export type { DischargeFlowProps } from './DischargeFlow';
export { RoundingList } from './RoundingList';
export type { RoundingListProps } from './RoundingList';
export { NoteComposer } from './NoteComposer';
export type { NoteComposerProps } from './NoteComposer';
export { OrderEntry } from './OrderEntry';
export type { OrderEntryProps } from './OrderEntry';
export { CodeBlueScreen } from './CodeBlueScreen';
export type { CodeBlueScreenProps } from './CodeBlueScreen';
export { HandoffComposer } from './HandoffComposer';
export type { HandoffComposerProps } from './HandoffComposer';
export { SecureMessaging } from './SecureMessaging';
export type { SecureMessagingProps } from './SecureMessaging';
export { WorkforceCoverage } from './WorkforceCoverage';
export type { WorkforceCoverageProps } from './WorkforceCoverage';
export { AlertsCenter } from './AlertsCenter';
export type { AlertsCenterProps } from './AlertsCenter';
export { BriefMeScreen } from './BriefMeScreen';
export type { BriefMeScreenProps } from './BriefMeScreen';
export { DeptCoordination } from './DeptCoordination';
export type { DeptCoordinationProps } from './DeptCoordination';


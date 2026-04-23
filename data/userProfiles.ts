import { UserRole, UserProfile, MetricDriver, ActionItem, Status } from '../types';
import {
  type ScenarioState,
  metricValue,
  scenarioFlags,
} from '../lib/scenario';

export const USERS: Record<UserRole, UserProfile> = {
  [UserRole.MANAGER]: {
    role: UserRole.MANAGER,
    name: 'Sarah Chen',
    title: 'Operations Director',
    avatarInitials: 'SC'
  },
  [UserRole.NURSE]: {
    role: UserRole.NURSE,
    name: 'David Miller',
    title: 'Charge Nurse',
    avatarInitials: 'DM'
  },
  [UserRole.ER_PERSONNEL]: {
    role: UserRole.ER_PERSONNEL,
    name: 'Dr. Emily Rostova',
    title: 'Trauma Attending',
    avatarInitials: 'ER'
  },
  [UserRole.TRAUMA]: {
    role: UserRole.TRAUMA,
    name: 'Dr. James Park',
    title: 'Trauma Surgery Lead',
    avatarInitials: 'JP'
  }
};

export const ROLE_METRICS: Record<UserRole, MetricDriver[]> = {
  [UserRole.MANAGER]: [
    { id: '1', name: 'Boarding Pressure', value: '24 Admitted', trend: 'up', status: Status.CRITICAL, impact: 95 },
    { id: '2', name: 'EMS Offload Risk', value: '45m Avg', trend: 'up', status: Status.WARNING, impact: 70 },
    { id: '3', name: 'Staffing Gap (RN)', value: '-2 FTE', trend: 'stable', status: Status.WARNING, impact: 60 },
  ],
  [UserRole.NURSE]: [
    { id: 'n1', name: 'Pain Reassessment', value: '4 Overdue', trend: 'up', status: Status.WARNING, impact: 80 },
    { id: 'n2', name: 'High Fall Risk', value: '2 Patients', trend: 'stable', status: Status.CRITICAL, impact: 65 },
    { id: 'n3', name: 'Discharge Pending', value: '3 Waiting', trend: 'down', status: Status.NORMAL, impact: 40 },
  ],
  [UserRole.ER_PERSONNEL]: [
    { id: 'e1', name: 'Trauma Bays', value: '0 Available', trend: 'down', status: Status.CRITICAL, impact: 98 },
    { id: 'e2', name: 'Triage Wait', value: '125 mins', trend: 'up', status: Status.WARNING, impact: 85 },
    { id: 'e3', name: 'Ambulance ETA', value: '3 (<5m)', trend: 'up', status: Status.CRITICAL, impact: 75 },
  ],
  [UserRole.TRAUMA]: [
    { id: 't1', name: 'Active Traumas', value: '2 In Bay', trend: 'up', status: Status.CRITICAL, impact: 95 },
    { id: 't2', name: 'OR Availability', value: '1 of 4', trend: 'down', status: Status.WARNING, impact: 80 },
    { id: 't3', name: 'Blood Bank', value: 'MTP Active', trend: 'stable', status: Status.CRITICAL, impact: 90 },
  ]
};

/**
 * Scenario-aware metric driver list. Same shape as ROLE_METRICS but
 * with values / statuses that reflect the currently running scenario.
 * When no scenario is active, returns values identical to ROLE_METRICS
 * so existing consumers see the baseline.
 *
 * The values are recomputed every time this function is called — which
 * is usually once per phase boundary (every ~30 s during a scenario)
 * because consumers wrap it in `useMemo(..., [scenario?.severity, scenarioPhase])`.
 */
export function getRoleMetrics(
  role: UserRole,
  scenario: ScenarioState | null,
  now: number = Date.now(),
): MetricDriver[] {
  const boarding = Math.round(metricValue('boardingAdmitted', scenario, now));
  const emsOffload = Math.round(metricValue('emsOffloadRiskMin', scenario, now));
  const rnShortfall = Math.round(metricValue('rnShortfall', scenario, now));
  const triageWait = Math.round(metricValue('triageWaitMin', scenario, now));
  const ambulance = Math.round(metricValue('ambulanceCount', scenario, now));
  const codes = Math.round(metricValue('activeCodes', scenario, now));
  const orAvail = Math.round(metricValue('orAvailable', scenario, now));
  const traumaBays = Math.round(metricValue('traumaBaysAvailable', scenario, now));
  const pendingDischarges = Math.round(metricValue('dischargesPending', scenario, now));
  const flags = scenarioFlags(scenario, now);

  const sev = scenario?.severity ?? 0;

  switch (role) {
    case UserRole.MANAGER:
      return [
        {
          id: '1',
          name: 'Boarding Pressure',
          value: `${Math.max(0, boarding)} Admitted`,
          trend: sev >= 2 ? 'up' : sev === 1 ? 'down' : 'up',
          status: boarding >= 30 ? Status.CRITICAL : boarding >= 22 ? Status.WARNING : Status.NORMAL,
          impact: Math.min(100, 60 + boarding),
        },
        {
          id: '2',
          name: 'EMS Offload Risk',
          value: `${Math.max(0, emsOffload)}m Avg`,
          trend: sev >= 2 ? 'up' : sev === 1 ? 'down' : 'stable',
          status: emsOffload >= 75 ? Status.CRITICAL : emsOffload >= 50 ? Status.WARNING : Status.NORMAL,
          impact: Math.min(100, Math.round((emsOffload / 100) * 100)),
        },
        {
          id: '3',
          name: 'Staffing Gap (RN)',
          value: `${rnShortfall} FTE`,
          trend: sev === 3 ? 'up' : 'stable',
          status: rnShortfall <= -4 ? Status.CRITICAL : rnShortfall <= -2 ? Status.WARNING : Status.NORMAL,
          impact: Math.min(100, Math.abs(rnShortfall) * 20),
        },
      ];

    case UserRole.NURSE:
      return [
        {
          id: 'n1',
          name: 'Pain Reassessment',
          value: `${sev === 3 ? 8 : sev === 2 ? 6 : sev === 1 ? 2 : 4} Overdue`,
          trend: sev >= 2 ? 'up' : 'down',
          status: sev === 3 ? Status.CRITICAL : Status.WARNING,
          impact: sev === 3 ? 95 : sev === 2 ? 85 : 70,
        },
        {
          id: 'n2',
          name: 'High Fall Risk',
          value: `${sev === 3 ? 5 : sev === 2 ? 3 : 2} Patients`,
          trend: sev >= 2 ? 'up' : 'stable',
          status: sev >= 2 ? Status.CRITICAL : Status.WARNING,
          impact: sev === 3 ? 85 : 65,
        },
        {
          id: 'n3',
          name: 'Discharge Pending',
          value: `${Math.max(0, pendingDischarges)} Waiting`,
          trend: sev === 1 ? 'up' : 'down',
          status: sev === 1 ? Status.WARNING : Status.NORMAL,
          impact: Math.min(100, pendingDischarges * 15),
        },
      ];

    case UserRole.ER_PERSONNEL:
      return [
        {
          id: 'e1',
          name: 'Trauma Bays',
          value: `${Math.max(0, traumaBays)} Available`,
          trend: sev >= 2 ? 'down' : 'stable',
          status: traumaBays === 0 ? Status.CRITICAL : traumaBays === 1 ? Status.WARNING : Status.NORMAL,
          impact: 100 - (traumaBays * 30),
        },
        {
          id: 'e2',
          name: 'Triage Wait',
          value: `${triageWait} mins`,
          trend: sev >= 2 ? 'up' : sev === 1 ? 'down' : 'stable',
          status: triageWait >= 150 ? Status.CRITICAL : triageWait >= 120 ? Status.WARNING : Status.NORMAL,
          impact: Math.min(100, Math.round(triageWait / 2)),
        },
        {
          id: 'e3',
          name: 'Ambulance ETA',
          value: `${ambulance} (<5m)`,
          trend: sev >= 2 ? 'up' : 'stable',
          status: ambulance >= 4 ? Status.CRITICAL : ambulance >= 2 ? Status.WARNING : Status.NORMAL,
          impact: Math.min(100, ambulance * 20),
        },
      ];

    case UserRole.TRAUMA:
      return [
        {
          id: 't1',
          name: 'Active Traumas',
          value: `${sev === 3 ? Math.max(2, codes) : sev === 2 ? 2 : 2} In Bay`,
          trend: sev === 3 ? 'up' : sev === 1 ? 'down' : 'up',
          status: sev === 3 ? Status.CRITICAL : Status.WARNING,
          impact: sev === 3 ? 100 : 85,
        },
        {
          id: 't2',
          name: 'OR Availability',
          value: `${Math.max(0, orAvail)} of 4`,
          trend: sev >= 2 ? 'down' : 'stable',
          status: orAvail <= 1 ? Status.CRITICAL : orAvail <= 2 ? Status.WARNING : Status.NORMAL,
          impact: 100 - (orAvail * 20),
        },
        {
          id: 't3',
          name: 'Blood Bank',
          value: flags.mtpActive ? 'MTP Active' : sev >= 2 ? '8u O-neg Ready' : 'Stocked',
          trend: 'stable',
          status: flags.mtpActive ? Status.CRITICAL : sev >= 2 ? Status.WARNING : Status.NORMAL,
          impact: flags.mtpActive ? 100 : 60,
        },
      ];

    default:
      return ROLE_METRICS[role];
  }
}

export const ROLE_ACTIONS: Record<UserRole, ActionItem[]> = {
  [UserRole.MANAGER]: [
    { 
      id: '1', 
      title: 'Open Overflow Unit 3A', 
      owner: 'Nursing Sup', 
      dueTime: '14:30', 
      status: 'In Progress', 
      priority: 'High',
      comments: ['[13:45] Sarah Chen: Nursing supervisor notified. Waiting for staffing confirmation.', '[14:00] Nursing Sup: 2 RNs secured. ETA 14:30.'],
      history: [
        { timestamp: '13:30', action: 'Action created', user: 'System' },
        { timestamp: '13:45', action: 'Status changed to In Progress', user: 'Sarah Chen' }
      ]
    },
    { 
      id: '2', 
      title: 'Call in Radiology Tech On-Call', 
      owner: 'Rad Director', 
      dueTime: '14:45', 
      status: 'On Hold', 
      priority: 'Medium',
      comments: ['[14:10] Rad Director: Left voicemail for on-call tech. Waiting for callback.'],
      history: [
        { timestamp: '14:05', action: 'Action created', user: 'System' },
        { timestamp: '14:10', action: 'Status changed to On Hold (Reason: Waiting for callback)', user: 'Rad Director' }
      ]
    },
    { id: '3', title: 'Divert Stroke Ambulances', owner: 'EMS Liaison', dueTime: '14:00', status: 'Completed', priority: 'High' },
    { id: '4', title: 'Expedite Discharges (4 identified)', owner: 'Charge Nurse', dueTime: '15:30', status: 'New', priority: 'High' },
  ],
  [UserRole.NURSE]: [
    { 
      id: 'n1', 
      title: 'Administer 14:00 Meds (Room 4)', 
      owner: 'Self', 
      dueTime: '14:15', 
      status: 'New', 
      priority: 'High',
      comments: ['[13:50] David Miller: Pharmacy confirmed meds are ready for pickup.'],
      history: [
        { timestamp: '13:45', action: 'Action created', user: 'System' }
      ]
    },
    { id: 'n2', title: 'Complete Discharge Paperwork (Room 8)', owner: 'Self', dueTime: '14:30', status: 'In Progress', priority: 'Medium' },
    { id: 'n3', title: 'Update Vitals (Room 2)', owner: 'Tech', dueTime: '14:00', status: 'Completed', priority: 'Low' },
    { id: 'n4', title: 'Check Blood Bank Order', owner: 'Lab', dueTime: '14:45', status: 'On Hold', priority: 'High' },
  ],
  [UserRole.ER_PERSONNEL]: [
    { 
      id: 'e1', 
      title: 'Clear Trauma Bay 1', 
      owner: 'EVS', 
      dueTime: '14:05', 
      status: 'In Progress', 
      priority: 'High',
      comments: ['[13:55] Dr. Emily Rostova: EVS paged stat.', '[14:00] EVS: On site, clearing now.'],
      history: [
        { timestamp: '13:55', action: 'Action created', user: 'System' },
        { timestamp: '14:00', action: 'Status changed to In Progress', user: 'EVS' }
      ]
    },
    { id: 'e2', title: 'Review Triage ECGs (3)', owner: 'Self', dueTime: '14:10', status: 'New', priority: 'High' },
    { id: 'e3', title: 'Consult Ortho (Bed 4)', owner: 'Resident', dueTime: '14:30', status: 'On Hold', priority: 'Medium' },
    { id: 'e4', title: 'Sign off EMS Handoffs', owner: 'Charge', dueTime: '13:50', status: 'Completed', priority: 'Low' },
  ],
  [UserRole.TRAUMA]: [
    { id: 't1', title: 'Prep Trauma Bay 1 for MVC Arrival', owner: 'Trauma RN', dueTime: '14:15', status: 'In Progress', priority: 'High' },
    { id: 't2', title: 'Request MTP — Blood Bank', owner: 'Self', dueTime: '14:10', status: 'New', priority: 'High' },
    { id: 't3', title: 'OR Hold for Exploratory Lap', owner: 'OR Charge', dueTime: '14:45', status: 'On Hold', priority: 'Medium' },
    { id: 't4', title: 'Review CT Head — Bed 2 Patient', owner: 'Radiology', dueTime: '14:20', status: 'In Progress', priority: 'High' },
  ]
};

export const ROLE_INSIGHTS: Record<UserRole, { situation: string, background: string, assessment: string, recommendation: string }> = {
  [UserRole.MANAGER]: {
    situation: "ED capacity stabilizing at 92%. Surge Protocol Level 2 is ACTIVE.",
    background: "Protocol activated at 14:15 due to critical bed holds. Fast Track expansion has processed 6 low-acuity patients.",
    assessment: "Risk forecast now trending DOWN. 90-min saturation projected at 75%. Staffing gaps remain in effect (-2 RNs).",
    recommendation: "1. Continue protocol for next 2 hours.\n2. Re-evaluate ambulance diversion status at 16:00."
  },
  [UserRole.NURSE]: {
    situation: "Unit 4West is at max capacity. 3 discharges pending transport.",
    background: "Shift change approaching (15:00). Acuity is high in rooms 4, 7, and 9.",
    assessment: "Pain management delays noted in Room 4. Discharge flow is bottlenecked by transport availability.",
    recommendation: "1. Prioritize Room 4 meds immediately.\n2. Call Transport directly for Room 8 discharge.\n3. Prep handoff for incoming shift."
  },
  [UserRole.ER_PERSONNEL]: {
    situation: "Trauma activation (Level 1) ETA 5 mins. Waiting room overflow.",
    background: "Multi-vehicle accident on I-95. 3 critical patients inbound. CT scanner 2 is down for maintenance.",
    assessment: "Trauma Bay 1 is dirty. Bay 2 is occupied. Airway cart needs restocking.",
    recommendation: "1. Clear Trauma Bay 1 immediately (EVS notified).\n2. Divert non-critical imaging to CT 1.\n3. Assign resident to fast-track triage."
  },
  [UserRole.TRAUMA]: {
    situation: "Level 1 trauma activation — MVC with 2 critical patients in bay. MTP initiated for Patient A.",
    background: "Patient A: GCS 8, unstable pelvis, positive FAST. Patient B: isolated TBI, GCS 12. OR 3 is available, OR 1 finishing at 14:30.",
    assessment: "Patient A requires emergent ex-lap within 30 minutes. Blood bank has 4 units O-neg ready. Anesthesia is standing by.",
    recommendation: "1. Move Patient A to OR 3 immediately.\n2. Hold OR 1 for Patient B if neuro consult recommends.\n3. Activate second trauma team for any new arrivals."
  }
};

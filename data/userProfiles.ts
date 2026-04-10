import { UserRole, UserProfile, MetricDriver, ActionItem, Status } from '../types';

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
  ]
};

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
  }
};

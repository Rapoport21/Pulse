export enum UserRole {
  MANAGER = 'Floor Manager',
  NURSE = 'Nurse',
  ER_PERSONNEL = 'ER Personnel',
}

export interface UserProfile {
  role: UserRole;
  name: string;
  title: string;
  avatarInitials: string;
}

export enum Tab {
  HORIZON = 'Pulse Horizon',
  LIVE_OPS = 'Live Ops',
  PLAYBOOKS = 'Playbooks',
  ACTIONS = 'Actions',
  BRIEF_ME = 'Brief Me',
  REPLAY = 'Replay',
  ROSTER = 'Roster',
}

export enum ConfidenceLevel {
  FULL = 'Full',
  PARTIAL = 'Partial',
  MANUAL = 'Manual',
}

export enum Status {
  NORMAL = 'Normal',
  WARNING = 'Warning',
  CRITICAL = 'Critical',
}

export interface MetricDriver {
  id: string;
  name: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  status: Status;
  impact: number; // 0-100 impact on overall load
}

export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  dueTime: string; // HH:mm
  status: 'New' | 'In Progress' | 'On Hold' | 'Completed' | 'Canceled';
  priority: 'High' | 'Medium' | 'Low';
  isDecision?: boolean;
  comments?: string[];
  history?: { timestamp: string; action: string; user: string }[];
  cancelReason?: string;
}

export interface LogEvent {
  id: string;
  time: string;
  type: 'METRIC' | 'DECISION' | 'ACTION' | 'NOTE';
  description: string;
  detail?: string;
}

export interface PlaybookStep {
  id: string;
  description: string;
  role: string;
  status: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  triggerCondition: string;
  approverRole: string;
  steps: PlaybookStep[];
  estimatedImpact: string;
}

export interface ZoneStatus {
  id: string;
  name: string;
  occupancy: number; // percentage
  capacity: number;
  patients: number;
  status: Status;
  trend: 'Rising' | 'Falling' | 'Stable';
  staffing: string;
  waitTime: string;
}
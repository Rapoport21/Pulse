/**
 * Initial urgent-task templates used when surge mode is activated.
 * Hardcoded for the demo so it's trivial to swap for Gemini-generated content
 * later — this file is the only place to change.
 */

export type UrgentPriority = 'critical' | 'high';

export interface UrgentTask {
  id: string;
  title: string;
  description?: string;
  role?: string;
  priority: UrgentPriority;
  acknowledged: boolean;
  acknowledgedBy: string | null; // device id of acknowledger
  acknowledgedAt: number | null;
}

export interface SurgeModeState {
  active: boolean;
  activatedAt: number | null;
}

interface SurgeTaskTemplate {
  title: string;
  description?: string;
  role?: string;
  priority: UrgentPriority;
}

export const SURGE_TASK_TEMPLATES: ReadonlyArray<SurgeTaskTemplate> = [
  { title: 'Open overflow bay in Hall C', description: 'Stage gurneys and clear corridor', role: 'Charge', priority: 'critical' },
  { title: 'Page Dr. Kim — trauma lead', description: 'Confirm ETA for trauma response', role: 'Charge', priority: 'critical' },
  { title: 'Reassign stable patients from Bay 3 to Med-Surg', description: 'Coordinate with Med-Surg for transfer', role: 'RN', priority: 'high' },
  { title: 'Prep 2 additional crash carts', description: 'Stock and verify O2 cylinders', role: 'RN', priority: 'high' },
  { title: 'Call radiology — hold non-urgent CTs', description: 'Free CT 1 for trauma scans', role: 'Charge', priority: 'high' },
];

export function buildInitialUrgentTasks(): UrgentTask[] {
  return SURGE_TASK_TEMPLATES.map((template, idx) => ({
    id: `surge-task-${idx + 1}`,
    title: template.title,
    description: template.description,
    role: template.role,
    priority: template.priority,
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
  }));
}

export const INITIAL_SURGE_STATE: SurgeModeState = {
  active: false,
  activatedAt: null,
};

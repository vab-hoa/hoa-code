export const STATUS_COLORS: Record<string, string> = {
  manager: 'bg-blue-500/10 text-blue-300 border border-blue-500/30',
  board: 'bg-red-500/10 text-red-300 border border-red-500/30',
  arc: 'bg-violet-500/10 text-violet-300 border border-violet-500/30',
  contractor: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30',
  'project: window_wells': 'bg-teal-500/10 text-teal-300 border border-teal-500/30',
  'project: concrete': 'bg-teal-500/10 text-teal-300 border border-teal-500/30',
  'project: lawns': 'bg-teal-500/10 text-teal-300 border border-teal-500/30',
  'project: wood_trim': 'bg-teal-500/10 text-teal-300 border border-teal-500/30',
  'project: asphalt': 'bg-teal-500/10 text-teal-300 border border-teal-500/30',
  'project: tree_trimming': 'bg-teal-500/10 text-teal-300 border border-teal-500/30',
  closed: 'bg-gray-500/5 text-gray-400 border border-gray-500/20',
  approved: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  approved_with_conditions: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  denied: 'bg-rose-500/10 text-rose-300 border border-rose-500/30',
  withdrawn: 'bg-gray-500/5 text-gray-400 border border-gray-500/20',
  notified: 'bg-blue-500/10 text-blue-300 border border-blue-500/30',
  fined: 'bg-red-500/10 text-red-300 border border-red-500/30',
  resolved: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
}

export const STATUS_LABELS: Record<string, string> = {
  manager: 'Manager',
  board: 'Board',
  arc: 'ARC Committee',
  contractor: 'Contractor',
  'project: window_wells': 'Project: Window Wells',
  'project: concrete': 'Project: Concrete',
  'project: lawns': 'Project: Lawns',
  'project: wood_trim': 'Project: Wood Trim',
  'project: asphalt': 'Project: Asphalt',
  'project: tree_trimming': 'Project: Tree Trimming',
  closed: 'Closed',
  approved: 'Approved',
  approved_with_conditions: 'Approved with Conditions',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
  notified: 'Notified',
  fined: 'Fined',
  resolved: 'Resolved',
}

export const CATEGORY_COLORS: Record<string, string> = {
  arc_request: 'bg-violet-500/10 text-violet-300',
  work_order: 'bg-blue-500/10 text-blue-300',
  violation: 'bg-red-500/10 text-red-300',
  other: 'bg-gray-500/10 text-gray-300',
}

export const CATEGORY_LABELS: Record<string, string> = {
  arc_request: 'ARC Request',
  work_order: 'Work Order',
  violation: 'Violation',
  other: 'Other',
}

export const DECISION_COLORS: Record<string, string> = {
  approved: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  approved_with_conditions: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
  denied: 'bg-rose-500/10 text-rose-300 border border-rose-500/30',
  no_approval_needed: 'bg-blue-500/10 text-blue-300 border border-blue-500/30',
  pending: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30',
  info_requested: 'bg-orange-500/10 text-orange-300 border border-orange-500/30',
}

export const DECISION_LABELS: Record<string, string> = {
  approved: 'Approved',
  approved_with_conditions: 'Approved with Conditions',
  denied: 'Denied',
  no_approval_needed: 'No Approval Needed',
  pending: 'Pending',
  info_requested: 'Info Requested',
}

export const EMAIL_CLASSIFICATION_LABELS: Record<string, string> = {
  noise: 'Noise',
  property_report: 'Property Report',
  wo_status_report: 'WO Status Report',
  arc_form_submission: 'ARC Form Submission',
  arc_manager_reply: 'ARC Manager Reply',
  arc_process_discussion: 'ARC Process Discussion',
  arc_form_forward: 'ARC Form Forward',
  wo_form: 'WO Form',
  hppr_form: 'HPPR Form',
  board_email: 'Board Email',
  josh_direct: 'Josh Direct',
  homeowner_direct: 'Homeowner Direct',
  governance: 'Governance',
  ops_alert: 'Ops Alert',
  unclassified: 'Unclassified',
}

export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

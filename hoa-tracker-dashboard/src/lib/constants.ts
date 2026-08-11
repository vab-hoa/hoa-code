export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  assigned: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  awaiting_quote: 'bg-orange-100 text-orange-800 border-orange-200',
  awaiting_board_approval: 'bg-purple-100 text-purple-800 border-purple-200',
  service_request: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  scheduled: 'bg-green-100 text-green-800 border-green-200',
  on_hold: 'bg-gray-100 text-gray-800 border-gray-200',
  pending_board_review: 'bg-red-100 text-red-800 border-red-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  approved_with_conditions: 'bg-amber-100 text-amber-800 border-amber-200',
  under_review_with_architect: 'bg-violet-100 text-violet-800 border-violet-200',
  denied: 'bg-rose-100 text-rose-800 border-rose-200',
  completed: 'bg-stone-100 text-stone-800 border-stone-200',
  closed: 'bg-stone-50 text-stone-600 border-stone-200',
  monitored: 'bg-teal-100 text-teal-800 border-teal-200',
  cancelled: 'bg-stone-50 text-stone-500 border-stone-200',
}

export const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  awaiting_quote: 'Awaiting Quote',
  awaiting_board_approval: 'Awaiting Board Approval',
  service_request: 'Service Request',
  scheduled: 'Scheduled',
  on_hold: 'On Hold',
  pending_board_review: 'Pending Board Review',
  approved: 'Approved',
  approved_with_conditions: 'Approved w/ Conditions',
  under_review_with_architect: 'Under Review w/ Architect',
  denied: 'Denied',
  completed: 'Completed',
  closed: 'Closed',
  monitored: 'Monitored',
  cancelled: 'Cancelled',
}

export const CATEGORY_COLORS: Record<string, string> = {
  arc_request: 'bg-violet-100 text-violet-800',
  work_order: 'bg-blue-100 text-blue-800',
  violation: 'bg-red-100 text-red-800',
  landscaping: 'bg-green-100 text-green-800',
  gutter: 'bg-cyan-100 text-cyan-800',
  roofing: 'bg-amber-100 text-amber-800',
  siding: 'bg-orange-100 text-orange-800',
  irrigation: 'bg-teal-100 text-teal-800',
  drainage: 'bg-indigo-100 text-indigo-800',
  painting: 'bg-pink-100 text-pink-800',
  general_repair: 'bg-stone-100 text-stone-800',
  governance: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800',
}

export const CATEGORY_LABELS: Record<string, string> = {
  arc_request: 'ARC Request',
  work_order: 'Work Order',
  violation: 'Violation',
  landscaping: 'Landscaping',
  gutter: 'Gutter',
  roofing: 'Roofing',
  siding: 'Siding',
  irrigation: 'Irrigation',
  drainage: 'Drainage',
  painting: 'Painting',
  general_repair: 'General Repair',
  governance: 'Governance',
  other: 'Other',
}

export const DECISION_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  approved_with_conditions: 'bg-amber-100 text-amber-800 border-amber-200',
  denied: 'bg-rose-100 text-rose-800 border-rose-200',
  no_approval_needed: 'bg-blue-100 text-blue-800 border-blue-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info_requested: 'bg-orange-100 text-orange-800 border-orange-200',
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

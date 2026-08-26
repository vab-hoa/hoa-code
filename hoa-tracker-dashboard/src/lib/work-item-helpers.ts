import type { OpenWorkItem, DashboardSummary } from './types'

export const TERMINAL_STATUSES_BY_CATEGORY: Record<string, string[]> = {
  arc_request: ['closed', 'approved', 'approved_with_conditions', 'denied'],
  work_order: ['closed', 'cancelled'],
  violation: ['closed', 'resolved'],
  landscaping: ['closed', 'cancelled'],
}
const DEFAULT_TERMINAL = ['closed', 'cancelled', 'denied']

export function isTerminalStatus(item: { category: string; status: string }): boolean {
  const terminal = TERMINAL_STATUSES_BY_CATEGORY[item.category] ?? DEFAULT_TERMINAL
  return terminal.includes(item.status)
}

export const WORK_ITEM_TYPES = [
  { key: 'arc_request', label: 'ARC Requests', categories: ['arc_request'] },
  { key: 'landscaping', label: 'Landscape', categories: ['landscaping'] },
  { key: 'violation', label: 'Violations', categories: ['violation'] },
  {
    key: 'work_order',
    label: 'Work Orders',
    categories: ['work_order', 'gutter', 'roofing', 'siding', 'irrigation', 'drainage', 'painting', 'general_repair', 'governance', 'other'],
  },
]

export function getWorkItemType(category: string): string {
  for (const type of WORK_ITEM_TYPES) {
    if (type.categories.includes(category)) return type.key
  }
  return 'work_order'
}

export const VALID_STATUSES_BY_CATEGORY: Record<string, string[]> = {
  arc_request: ['new', 'under_review_with_architect', 'approved', 'approved_with_conditions', 'denied', 'closed'],
  work_order: ['open', 'pending_board_review', 'closed', 'approved', 'awaiting_quote', 'on_hold', 'scheduled', 'monitored', 'service_request', 'past_due', 'new', 'assigned', 'in_progress', 'cancelled'],
  violation: ['notified', 'fined', 'resolved', 'closed'],
  landscaping: ['new', 'service_request', 'scheduled', 'closed', 'cancelled'],
}

export function getValidStatusesForCategory(category: string): string[] {
  return VALID_STATUSES_BY_CATEGORY[category] ?? []
}

export function isValidStatus(category: string, status: string): boolean {
  const validStatuses = getValidStatusesForCategory(category)
  return validStatuses.includes(status)
}

export function computeSummaryCounts(items: OpenWorkItem[]): DashboardSummary {
  return {
    total_open: items.length,
    new_count: items.filter(i => i.status === 'new').length,
    on_hold_count: items.filter(i => i.status === 'on_hold').length,
    awaiting_quote_count: items.filter(i => i.status === 'awaiting_quote').length,
    service_request_count: items.filter(i => i.status === 'service_request').length,
    scheduled_count: items.filter(i => i.status === 'scheduled').length,
    pending_board_count: items.filter(i => i.status === 'pending_board_review').length,
    arc_in_review: items.filter(
      i => i.status === 'under_review_with_architect'
    ).length,
    approved_count: items.filter(i => i.status === 'approved').length,
    approved_with_conditions_count: items.filter(
      i => i.status === 'approved_with_conditions'
    ).length,
    denied_count: items.filter(i => i.status === 'denied').length,
    total_all_time: items.length,
  }
}

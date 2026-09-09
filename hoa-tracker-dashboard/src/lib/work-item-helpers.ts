import type { OpenWorkItem, DashboardSummary } from './types'

export const ALL_TERMINAL_STATUSES = [
  'closed',
  'approved',
  'approved_with_conditions',
  'denied',
  'withdrawn',
  'resolved',
]

export function isTerminalStatus(item: { category: string; status: string }): boolean {
  return ALL_TERMINAL_STATUSES.includes(item.status)
}

export const WORK_ITEM_TYPES = [
  { key: 'arc_request', label: 'ARC Requests', categories: ['arc_request'] },
  { key: 'violation', label: 'Violations', categories: ['violation'] },
  {
    key: 'work_order',
    label: 'Work Orders',
    categories: ['work_order', 'other'],
  },
]

export function getWorkItemType(category: string): string {
  for (const type of WORK_ITEM_TYPES) {
    if (type.categories.includes(category)) return type.key
  }
  return 'work_order'
}

export const ALL_VALID_STATUSES = [
  'manager',
  'board',
  'arc',
  'contractor',
  'project: window_wells',
  'project: concrete',
  'project: lawns',
  'project: wood_trim',
  'project: asphalt',
  'project: tree_trimming',
  'closed',
  'approved',
  'approved_with_conditions',
  'denied',
  'withdrawn',
  'notified',
  'fined',
  'resolved',
]

export function getValidStatusesForCategory(_category: string): string[] {
  // All statuses are valid for all categories — category does not gate status
  return ALL_VALID_STATUSES
}

export function isValidStatus(category: string, status: string): boolean {
  const validStatuses = getValidStatusesForCategory(category)
  return validStatuses.includes(status)
}

export function computeSummaryCounts(items: OpenWorkItem[]): DashboardSummary {
  return {
    total_open: items.length,
    manager_count: items.filter(i => i.status === 'manager').length,
    board_count: items.filter(i => i.status === 'board').length,
    arc_count: items.filter(i => i.status === 'arc').length,
    contractor_count: items.filter(i => i.status === 'contractor').length,
    project_count: items.filter(i => i.status.startsWith('project:')).length,
    closed_count: items.filter(
      i => i.status === 'closed' || ALL_TERMINAL_STATUSES.includes(i.status)
    ).length,
    total_all_time: items.length,
  }
}

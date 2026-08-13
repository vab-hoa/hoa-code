import type { OpenWorkItem, AgingWorkItem, DashboardSummary } from './types'

export function isTerminalArcDecision(item: { category: string; decision: string | null }): boolean {
  return (
    item.category === 'arc_request' &&
    (item.decision === 'approved' || item.decision === 'approved_with_conditions')
  )
}

export function getEffectiveBadge(item: {
  category: string
  status: string
  decision: string | null
}): { kind: 'status' | 'decision'; value: string } {
  if (isTerminalArcDecision(item)) {
    return { kind: 'decision', value: item.decision! }
  }
  return { kind: 'status', value: item.status }
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
    awaiting_board_approval: items.filter(i => i.status === 'awaiting_board_approval')
      .length,
    arc_in_review: items.filter(
      i => i.status === 'under_review_with_architect'
    ).length,
    approved_count: items.filter(i => i.status === 'approved').length,
    approved_with_conditions_count: items.filter(
      i => i.status === 'approved_with_conditions'
    ).length,
    denied_count: items.filter(i => i.status === 'denied').length,
    decision_approved: items.filter(i => i.decision === 'approved').length,
    decision_approved_conditions: items.filter(
      i => i.decision === 'approved_with_conditions'
    ).length,
    decision_denied: items.filter(i => i.decision === 'denied').length,
    decision_no_approval_needed: items.filter(
      i => i.decision === 'no_approval_needed'
    ).length,
    decision_pending: items.filter(i => i.decision === 'pending').length,
    decision_info_requested: items.filter(
      i => i.decision === 'info_requested'
    ).length,
    total_all_time: items.length,
  }
}

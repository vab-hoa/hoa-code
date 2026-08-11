export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null

  const colors: Record<string, { dot: string; text: string }> = {
    urgent: { dot: 'bg-red-500', text: 'text-red-700' },
    high: { dot: 'bg-orange-500', text: 'text-orange-700' },
    medium: { dot: 'bg-yellow-500', text: 'text-yellow-700' },
    low: { dot: 'bg-gray-400', text: 'text-gray-600' },
  }

  const style = colors[priority] || { dot: 'bg-gray-400', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${style.text}`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  )
}

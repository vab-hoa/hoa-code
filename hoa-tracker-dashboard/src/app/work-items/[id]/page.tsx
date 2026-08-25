'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWorkItem } from '@/hooks/useWorkItem'
import { supabase } from '@/lib/supabase'
import { uploadWorkItemDocument, updateWorkItemDocumentTitle, getWorkItemDocumentUrl, markWorkItemCompleted } from '@/lib/queries'
import { TERMINAL_STATUSES_BY_CATEGORY } from '@/lib/work-item-helpers'
import { Loading } from '@/components/loading'
import { StatusBadge } from '@/components/status-badge'
import { CategoryBadge } from '@/components/category-badge'
import { DecisionBadge } from '@/components/decision-badge'
import { CorrespondenceTimeline } from '@/components/correspondence-timeline'
import { formatDate, formatCurrency } from '@/lib/format'

export default function WorkItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const router = useRouter()
  const { item, correspondence, emails, statusHistory, documents, loading, error } = useWorkItem(id)

  const [showExclusionDialog, setShowExclusionDialog] = useState(false)
  const [exclusionReason, setExclusionReason] = useState('')
  const [excludingName, setExcludingName] = useState('')
  const [isExcluding, setIsExcluding] = useState(false)

  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [completionStatus, setCompletionStatus] = useState('')
  const [isCompleting, setIsCompleting] = useState(false)

  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadedBy, setUploadedBy] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [localDocuments, setLocalDocuments] = useState(documents)

  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [editingDocTitle, setEditingDocTitle] = useState('')

  React.useEffect(() => {
    setLocalDocuments(documents)
  }, [documents])

  const handleExclude = async () => {
    if (!exclusionReason.trim() || !excludingName.trim()) {
      alert('Please provide both a name and reason')
      return
    }

    setIsExcluding(true)
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        excluded_at: new Date().toISOString(),
        excluded_by: excludingName,
        excluded_reason: exclusionReason,
      })
      .eq('id', id)

    setIsExcluding(false)

    if (updateError) {
      alert('Error excluding item: ' + updateError.message)
      return
    }

    setShowExclusionDialog(false)
    router.push('/')
  }

  const handleMarkCompleted = async () => {
    if (!completionStatus.trim()) {
      alert('Please select a completion status')
      return
    }

    setIsCompleting(true)
    const result = await markWorkItemCompleted(id, completionStatus)
    setIsCompleting(false)

    if (!result.success) {
      alert('Error marking item as completed: ' + (result.error || 'Unknown error'))
      return
    }

    setShowCompletionDialog(false)

    // Redirect after a brief delay to show completion
    setTimeout(() => {
      router.push('/')
    }, 500)
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      alert('Please select a file')
      return
    }

    setIsUploading(true)
    const result = await uploadWorkItemDocument(
      id,
      uploadFile,
      uploadTitle || null,
      uploadedBy || 'Unknown'
    )
    setIsUploading(false)

    if (result) {
      setLocalDocuments([result, ...localDocuments])
      setUploadFile(null)
      setUploadTitle('')
      setUploadedBy('')
      setShowUploadDialog(false)
    } else {
      alert('Error uploading document')
    }
  }

  const handleSaveTitle = async (docId: string, newTitle: string) => {
    const success = await updateWorkItemDocumentTitle(docId, newTitle || null)
    if (success) {
      setLocalDocuments(
        localDocuments.map(d => (d.id === docId ? { ...d, title: newTitle || null } : d))
      )
      setEditingDocId(null)
    } else {
      alert('Error updating title')
    }
  }

  if (loading) return <Loading />
  if (error) return <div className="p-6 text-red-400">Error: {error}</div>
  if (!item) return <div className="p-6 text-mute">Work item not found</div>

  return (
    <div className="bg-app-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link href="/" className="text-blue-300 hover:underline text-sm mb-4 inline-block">
          ← Back to dashboard
        </Link>

        <div className="bg-surface border border-edge rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-ink mb-3">{item.title}</h1>
              <div className="flex gap-2 flex-wrap mb-4">
                <StatusBadge status={item.status} size="md" />
                <CategoryBadge category={item.category} size="md" />
              </div>

              {item.property_id && (
                <>
                  <p className="text-sm text-mute mb-2">
                    Property:{' '}
                    <Link
                      href={`/properties/${item.property_id}`}
                      className="text-blue-300 hover:underline"
                    >
                      {(item as any).properties?.parcel_code || 'View property'}
                    </Link>
                  </p>
                  {(item as any).properties?.owner_name && (
                    <p className="text-sm text-mute mb-4">
                      Owner: {(item as any).properties.owner_name}
                    </p>
                  )}
                </>
              )}

              {item.description && (
                <div className="mt-4 p-3 bg-edge/25 rounded text-sm text-ink">
                  {item.description}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={() => {
                  const terminals = TERMINAL_STATUSES_BY_CATEGORY[item.category] || ['closed', 'cancelled', 'denied']
                  setCompletionStatus(terminals[0])
                  setShowCompletionDialog(true)
                }}
                className="px-3 py-1 bg-green-500/20 border border-green-500/50 text-green-300 text-sm rounded hover:bg-green-500/30 transition-colors whitespace-nowrap"
              >
                Mark as completed
              </button>
              <button
                onClick={() => setShowExclusionDialog(true)}
                className="px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-300 text-sm rounded hover:bg-red-500/30 transition-colors whitespace-nowrap"
              >
                Mark as excluded
              </button>
            </div>
          </div>
        </div>

        {item.decision && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-blue-300 mb-2">Decision: {item.decision_by || 'TBD'}</h3>
            <div className="space-y-1 text-sm text-blue-200">
              <div>
                <DecisionBadge decision={item.decision} />
              </div>
              {item.decision_at && <div>Date: {formatDate(item.decision_at)}</div>}
              {item.decision_rationale && (
                <div className="mt-2 italic">&quot;{item.decision_rationale}&quot;</div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-surface border border-edge rounded-lg p-4">
            <h3 className="font-bold text-ink mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-mute">Status</dt>
                <dd className="font-medium text-ink">
                  <StatusBadge status={item.status} />
                </dd>
              </div>
              <div>
                <dt className="text-mute">Category</dt>
                <dd>
                  <CategoryBadge category={item.category} />
                </dd>
              </div>
              {item.assigned_to && (
                <div>
                  <dt className="text-mute">Assigned To</dt>
                  <dd className="text-ink">{item.assigned_to}</dd>
                </div>
              )}
              {item.vendor && (
                <div>
                  <dt className="text-mute">Vendor</dt>
                  <dd className="text-ink">{item.vendor}</dd>
                </div>
              )}
              {item.keystone_wo_number && (
                <div>
                  <dt className="text-mute">Keystone WO #</dt>
                  <dd className="font-mono text-ink">{item.keystone_wo_number}</dd>
                </div>
              )}
              <div>
                <dt className="text-mute">Created</dt>
                <dd className="text-ink">{formatDate(item.created_date)}</dd>
              </div>
              {item.due_date && (
                <div>
                  <dt className="text-mute">Due Date</dt>
                  <dd className="text-ink">{formatDate(item.due_date)}</dd>
                </div>
              )}
              {item.closed_date && (
                <div>
                  <dt className="text-mute">Closed</dt>
                  <dd className="text-ink">{formatDate(item.closed_date)}</dd>
                </div>
              )}
              {item.estimated_cost && (
                <div>
                  <dt className="text-mute">Estimated Cost</dt>
                  <dd className="font-medium text-ink">
                    {formatCurrency(item.estimated_cost)}
                  </dd>
                </div>
              )}
              {item.bid_amount && (
                <div>
                  <dt className="text-mute">Bid Amount</dt>
                  <dd className="font-medium text-ink">{formatCurrency(item.bid_amount)}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-surface border border-edge rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-ink">Documents</h3>
              <button
                onClick={() => setShowUploadDialog(true)}
                className="px-2 py-1 text-xs bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded hover:bg-blue-500/30 transition-colors"
              >
                + Upload
              </button>
            </div>

            {localDocuments.length === 0 ? (
              <p className="text-sm text-mute italic">No documents yet</p>
            ) : (
              <div className="space-y-3">
                {localDocuments.map(doc => (
                  <div key={doc.id} className="border-l-2 border-edge/50 pl-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {editingDocId === doc.id ? (
                          <div className="flex gap-1 mb-1">
                            <input
                              type="text"
                              value={editingDocTitle}
                              onChange={e => setEditingDocTitle(e.target.value)}
                              placeholder="Document title"
                              className="flex-1 px-2 py-1 text-xs bg-edge border border-edge text-ink rounded"
                            />
                            <button
                              onClick={() => handleSaveTitle(doc.id, editingDocTitle)}
                              className="px-2 py-1 text-xs bg-green-500/20 text-green-300 rounded hover:bg-green-500/30"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingDocId(null)}
                              className="px-2 py-1 text-xs bg-edge text-mute rounded hover:bg-edge/70"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-1">
                            <a
                              href={getWorkItemDocumentUrl(doc.storage_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-300 hover:underline text-sm font-medium truncate"
                            >
                              {doc.title || <span className="italic text-mute">Untitled document</span>}
                            </a>
                            <button
                              onClick={() => {
                                setEditingDocId(doc.id)
                                setEditingDocTitle(doc.title || '')
                              }}
                              className="text-mute hover:text-ink text-xs"
                              title="Edit title"
                            >
                              ✎
                            </button>
                          </div>
                        )}
                        <div className="text-xs text-mute">
                          {doc.file_name}
                        </div>
                        <div className="text-xs text-mute/60">
                          {formatDate(doc.uploaded_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-ink mb-4">Correspondence & Emails</h2>
          <CorrespondenceTimeline correspondence={correspondence} emails={emails} />
        </div>

        {statusHistory.length > 0 && (
          <div className="bg-surface border border-edge rounded-lg p-6">
            <h2 className="text-lg font-bold text-ink mb-4">Status History</h2>
            <div className="space-y-2 text-sm">
              {statusHistory.map(entry => (
                <div key={entry.id} className="flex items-center gap-2">
                  <span className="text-mute">{formatDate(entry.entry_date)}</span>
                  <StatusBadge status={entry.old_status!} /> →{' '}
                  <StatusBadge status={entry.new_status!} />
                  <span className="text-mute">by {entry.author_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload dialog */}
        {showUploadDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-edge rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold text-ink mb-4">Upload document</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Select file (PDF, JPG, PNG)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 bg-edge border border-edge text-ink rounded text-sm"
                  />
                  {uploadFile && (
                    <p className="text-xs text-mute mt-1">{uploadFile.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="e.g., ARC Request Form"
                    className="w-full px-3 py-2 bg-edge border border-edge text-ink rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Your name
                  </label>
                  <input
                    type="text"
                    value={uploadedBy}
                    onChange={e => setUploadedBy(e.target.value)}
                    placeholder="e.g., Dee Buck"
                    className="w-full px-3 py-2 bg-edge border border-edge text-ink rounded text-sm"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowUploadDialog(false)}
                    disabled={isUploading}
                    className="px-3 py-2 bg-edge border border-edge text-ink rounded text-sm hover:bg-edge/70 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={isUploading || !uploadFile}
                    className="px-3 py-2 bg-blue-500/20 border border-blue-500 text-blue-300 rounded text-sm hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completion dialog */}
        {showCompletionDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-edge rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold text-ink mb-4">Mark as completed</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Final status
                  </label>
                  <div className="space-y-2">
                    {(TERMINAL_STATUSES_BY_CATEGORY[item.category] || ['closed', 'cancelled', 'denied']).map(status => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="completion-status"
                          value={status}
                          checked={completionStatus === status}
                          onChange={e => setCompletionStatus(e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-ink capitalize">{status.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-mute">
                  This will update the status and set the closed date to today. The item will no longer appear in aging alerts.
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowCompletionDialog(false)}
                    disabled={isCompleting}
                    className="px-3 py-2 bg-edge border border-edge text-ink rounded text-sm hover:bg-edge/70 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMarkCompleted}
                    disabled={isCompleting || !completionStatus.trim()}
                    className="px-3 py-2 bg-green-500/20 border border-green-500 text-green-300 rounded text-sm hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    {isCompleting ? 'Completing...' : 'Mark as completed'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exclusion dialog */}
        {showExclusionDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-edge rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold text-ink mb-4">Mark as excluded</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Your name
                  </label>
                  <input
                    type="text"
                    value={excludingName}
                    onChange={e => setExcludingName(e.target.value)}
                    placeholder="e.g., Dee Buck"
                    className="w-full px-3 py-2 bg-edge border border-edge text-ink rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Reason for exclusion
                  </label>
                  <textarea
                    value={exclusionReason}
                    onChange={e => setExclusionReason(e.target.value)}
                    placeholder="e.g., Stale landscape request, already handled by xyz"
                    className="w-full px-3 py-2 bg-edge border border-edge text-ink rounded text-sm h-24 resize-none"
                  />
                </div>

                <p className="text-xs text-mute">
                  This item will be removed from all dashboards but will be soft-deleted in the database (recoverable).
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowExclusionDialog(false)}
                    disabled={isExcluding}
                    className="px-3 py-2 bg-edge border border-edge text-ink rounded text-sm hover:bg-edge/70 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExclude}
                    disabled={isExcluding || !exclusionReason.trim() || !excludingName.trim()}
                    className="px-3 py-2 bg-red-500/20 border border-red-500 text-red-300 rounded text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    {isExcluding ? 'Excluding...' : 'Exclude'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

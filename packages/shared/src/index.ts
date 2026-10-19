// @vab-hoa/shared — shared types and helpers for HOA tracker
// Re-exports from dashboard lib so both packages use the same definitions

export type {
  Property,
  WorkItem,
  CorrespondenceEntry,
  EmailMessage,
  EmailThread,
  IssueEmailLink,
  WoStatusSnapshot,
  SourceDocument,
  AgingConfig,
  WorkItemDocument,
  DashboardSummary,
  OpenWorkItem,
  AgingWorkItem,
  WorkItemCategory,
  WorkItemStatus,
  Decision,
  WorkItemNote,
} from './types.js'

export {
  normalizeStreetName,
  streetCodeFor,
  unitDigit,
  parcelCodeFromParts,
} from './parcel.js'

export {
  STATUS_LABELS,
  CATEGORY_LABELS,
  EMAIL_CLASSIFICATION_LABELS,
  PRIORITY_ORDER,
} from './constants.js'
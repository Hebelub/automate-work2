export interface JiraTask {
  id: string
  key: string
  name: string
  status: 'Open' | 'In Progress' | 'On Hold' | 'QA' | 'Ready for PROD' | 'Done' | 'Rejected'
  issueType: string
  issueTypeIconUrl?: string // URL to the issue type icon from Jira
  isInSprint: boolean
  assignee: string
  priority: string
  priorityIconUrl?: string // URL to the priority icon from Jira
  description: string
  url: string
  lastJiraUpdate?: string // ISO timestamp of when task was last updated in Jira
  childTasks?: TaskWithPRs[]
}

export interface LocalGitStatus {
  branch: string
  exists: boolean
  isUpToDate: boolean
  ahead: number
  behind: number
  lastCommit?: string
  hasRemote: boolean
  repository?: string
  lastChecked?: string // ISO timestamp of when status was last checked
}

export interface LocalBranch {
  branch: string
  repository: string
  lastCommit?: string
  hasRemote: boolean
  isAhead: boolean
  aheadCount: number
  remoteOrigin?: string
}

// Base PR interface with common fields
export interface BaseGitHubPR {
  id: string
  title: string
  number: number
  branch: string
  url: string
  author: string
  createdAt: string
  updatedAt: string
  repository: string
  isDraft: boolean
  localGitStatus?: LocalGitStatus
}

// PR for JIRA tasks (simpler, focused on task linking)
export interface GitHubPR extends BaseGitHubPR {
  status: 'open' | 'closed' | 'merged' | 'draft'
  linkedTaskKey?: string // JIRA task key this PR is linked to
  reviewStatus: 'pending' | 'approved' | 'changes_requested' | 'no_reviews'
  requestedReviewers: string[]
  approvedReviewers: string[]
}

// PR for review inbox (detailed review information)
export interface ReviewGitHubPR extends BaseGitHubPR {
  // Review-specific fields
  approvedReviews: number
  changesRequestedReviews: number
  pendingReviews: number
  totalReviews: number
  reviewers: string[]
  reviewStatus: 'pending_review' | 'approved' | 'changes_requested' | 'no_reviews'
  
  // Additional PR details from GitHub API
  body: string
  state: string
  baseBranch: string
  mergedAt: string | null
  closedAt: string | null
  commits: number
  additions: number
  deletions: number
  changedFiles: number
}

export interface TaskWithPRs extends JiraTask {
  pullRequests: GitHubPR[]
  localBranches?: LocalBranch[] // Local branches that match this task
  // Local metadata fields
  parentTaskId?: string
  notes?: string
  hiddenStatus?: 'visible' | 'hidden' | 'hiddenUntilUpdated' // Hidden status from metadata
  hiddenUntilUpdatedDate?: string // ISO timestamp when "hide until updated" was set
  childTasksExpanded?: boolean
  pullRequestsExpanded?: boolean
  localBranchesExpanded?: boolean
}

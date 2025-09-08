export interface JiraTask {
  id: string
  key: string
  name: string
  status: 'Open' | 'In Progress' | 'On Hold' | 'QA' | 'Ready for PROD' | 'Done' | 'Rejected'
  issueType: string
  isInSprint: boolean
  assignee: string
  priority: string
  description: string
  url: string
  // Local metadata
  parentTaskId?: string
  notes?: string
  hidden: boolean
  childTasksExpanded?: boolean
  pullRequestsExpanded?: boolean
  localBranchesExpanded?: boolean
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

export interface GitHubPR {
  id: string
  title: string
  number: number
  status: 'open' | 'closed' | 'merged' | 'draft'
  branch: string
  url: string
  author: string
  createdAt: string
  updatedAt: string
  linkedTaskKey?: string // JIRA task key this PR is linked to
  repository?: string // Repository name (e.g., "owner/repo")
  isDraft: boolean
  reviewStatus: 'pending' | 'approved' | 'changes_requested' | 'no_reviews'
  requestedReviewers: string[]
  approvedReviewers: string[]
  localGitStatus?: LocalGitStatus // Local git information
}

export interface TaskWithPRs extends JiraTask {
  pullRequests: GitHubPR[]
  localBranches?: LocalBranch[] // Local branches that match this task
}

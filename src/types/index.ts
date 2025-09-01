export interface JiraTask {
  id: string
  key: string
  name: string
  status: 'To Do' | 'In Progress' | 'QA' | 'Done' | 'Blocked' | 'Rejected'
  isInSprint: boolean
  assignee: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  description?: string
  url: string
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
}

export interface TaskWithPRs extends JiraTask {
  pullRequests: GitHubPR[]
}

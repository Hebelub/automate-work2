import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a git branch name for a Jira task
 * @param taskKey - The Jira task key (e.g., "ROC-4220")
 * @param taskName - The Jira task name
 * @param issueType - The Jira issue type (e.g., "bug", "story", "task")
 * @returns The generated branch name
 */
export function generateBranchName(taskKey: string, taskName: string, issueType: string): string {
  // Determine prefix based on issue type
  const isBug = issueType.toLowerCase() === 'bug' || issueType.toLowerCase() === 'devbug'
  const prefix = isBug ? 'bugfix' : 'feature'
  
  // Sanitize task name: remove special characters and replace spaces with underscores
  const sanitizedName = taskName
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase()
  
  return `${prefix}/${taskKey}_${sanitizedName}`
}

/**
 * Generates a git checkout command for a Jira task
 * @param taskKey - The Jira task key (e.g., "ROC-4220")
 * @param taskName - The Jira task name
 * @param issueType - The Jira issue type (e.g., "bug", "story", "task")
 * @returns The git checkout command
 */
export function generateGitCheckoutCommand(taskKey: string, taskName: string, issueType: string): string {
  const branchName = generateBranchName(taskKey, taskName, issueType)
  return `git checkout -b ${branchName}`
}

/**
 * Gets the priority score for a task status
 * Lower numbers = higher priority (appears first)
 */
function getStatusPriority(status: string): number {
  switch (status.toLowerCase()) {
    case 'in progress':
      return 1
    case 'ready for prod':
      return 2
    case 'open':
    case 'todo':
      return 3
    case 'qa':
      return 4
    case 'review':
      return 5
    case 'on hold':
      return 6
    case 'done':
      return 7
    case 'rejected':
      return 8
    default:
      return 9 // Unknown status goes to bottom
  }
}

/**
 * Gets the priority score for an issue type
 * Lower numbers = higher priority (appears first)
 */
function getIssueTypePriority(issueType: string): number {
  switch (issueType.toLowerCase()) {
    case 'bug':
      return 1
    case 'devbug':
      return 2
    case 'story':
      return 3
    case 'task':
      return 4
    case 'sub-task':
      return 5
    case 'epic':
      return 6
    default:
      return 7 // Unknown type goes to bottom
  }
}

/**
 * Gets the priority score for a task priority
 * Lower numbers = higher priority (appears first)
 */
function getPriorityValue(priority: string): number {
  switch (priority.toLowerCase()) {
    case 'blocker':
      return 1
    case 'critical':
      return 2
    case 'urgent':
      return 3
    case 'major':
      return 4
    case 'high':
      return 5
    case 'minor':
      return 6
    case 'low':
      return 7
    case 'trivial':
      return 8
    default:
      return 9 // Default for unknown priorities
  }
}

/**
 * Sorts tasks by priority (hidden status first, then sprint status, then status, then priority, then issue type)
 * @param tasks - Array of tasks to sort
 * @returns Sorted array of tasks
 */
export function sortTasksByPriority<T extends { status: string; issueType: string; priority?: string; hiddenStatus?: 'visible' | 'hidden' | 'hiddenUntilUpdated'; lastJiraUpdate?: string; hiddenUntilUpdatedDate?: string; isInSprint?: boolean }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    // First, compare by actual visibility - hidden tasks go to bottom
    const isTaskVisible = (task: T) => {
      if (task.hiddenStatus === 'visible') return true
      if (task.hiddenStatus === 'hidden') return false
      if (task.hiddenStatus === 'hiddenUntilUpdated') {
        // If no lastJiraUpdate, always show (as per user requirement)
        if (!task.lastJiraUpdate) return true
        // If no hiddenUntilUpdatedDate, show (safety check)
        if (!task.hiddenUntilUpdatedDate) return true
        // Compare timestamps - show if Jira was updated after hiding
        const jiraUpdateTime = new Date(task.lastJiraUpdate).getTime()
        const hiddenTime = new Date(task.hiddenUntilUpdatedDate).getTime()
        return jiraUpdateTime > hiddenTime
      }
      return true // Default to visible for unknown status
    }
    
    const aVisible = isTaskVisible(a)
    const bVisible = isTaskVisible(b)
    
    if (aVisible && !bVisible) return -1
    if (!aVisible && bVisible) return 1
    
    // If both have same visibility, sort by hiddenStatus for paused vs hidden
    if (!aVisible && !bVisible) {
      if (a.hiddenStatus === 'hiddenUntilUpdated' && b.hiddenStatus === 'hidden') return -1
      if (a.hiddenStatus === 'hidden' && b.hiddenStatus === 'hiddenUntilUpdated') return 1
    }
    
    // If both have same visibility, compare by sprint status - tasks not in sprint go to bottom
    const aInSprint = a.isInSprint ?? true // Default to true if not specified
    const bInSprint = b.isInSprint ?? true // Default to true if not specified
    
    if (aInSprint && !bInSprint) return -1
    if (!aInSprint && bInSprint) return 1
    
    // If both have same sprint status, compare by status priority
    const statusA = getStatusPriority(a.status)
    const statusB = getStatusPriority(b.status)
    
    if (statusA !== statusB) {
      return statusA - statusB
    }
    
    // If status is the same, compare by priority
    const priorityA = getPriorityValue(a.priority || '')
    const priorityB = getPriorityValue(b.priority || '')
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // If priority is the same, compare by issue type priority
    const typeA = getIssueTypePriority(a.issueType)
    const typeB = getIssueTypePriority(b.issueType)
    
    return typeA - typeB
  })
}

/**
 * Formats a timestamp to show relative time (e.g., "2m", "3h", "5d")
 * @param createdAt - ISO timestamp string
 * @returns Formatted relative time string
 */
export function formatTimeSince(createdAt: string): string {
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()
  
  const minutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (minutes < 60) {
    return `${minutes}m`
  } else if (hours < 24) {
    return `${hours}h`
  } else {
    return `${days}d`
  }
}

/**
 * Generates a test channel URL for tfso/website-accounting branches
 * @param branchName - The branch name to convert
 * @returns The test channel URL
 */
export function generateTestChannelUrl(branchName: string, jiraTaskKey?: string): string {
  // Replace '/' and '_' with '-' in the branch name
  const sanitizedBranch = branchName.replace(/[/_]/g, '-')
  let url = `https://beta.24sevenoffice.com/modules/accounting/vouchers?channel=${sanitizedBranch}`
  
  if (jiraTaskKey) {
    url += `&env=${jiraTaskKey}`
  }
  
  return url
}

/**
 * Finds the latest branch from tfso/website-accounting repository
 * @param pullRequests - Array of pull requests to search through
 * @returns The latest branch name or null if not found
 */
export function findLatestWebsiteAccountingBranch(pullRequests: any[]): string | null {
  // Filter PRs from tfso/website-accounting repository
  const websiteAccountingPRs = pullRequests.filter(pr => 
    pr.repository === 'tfso/website-accounting'
  )

  if (websiteAccountingPRs.length === 0) {
    return null
  }

  // Sort by updatedAt (most recent first) and get the first one
  const sortedPRs = websiteAccountingPRs.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return sortedPRs[0]?.branch || null
}

/**
 * Finds the latest branch from tfso/apiworker-voucher repository and extracts Jira task key
 * @param pullRequests - Array of pull requests to search through
 * @returns The Jira task key or null if not found
 */
export function findApiWorkerVoucherJiraTask(pullRequests: any[]): string | null {
  // Filter PRs from tfso/apiworker-voucher repository
  const apiWorkerPRs = pullRequests.filter(pr => 
    pr.repository === 'tfso/apiworker-voucher'
  )
  
  if (apiWorkerPRs.length === 0) {
    return null
  }
  
  // Sort by updated date (most recent first)
  const sortedPRs = apiWorkerPRs.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  
  const latestBranch = sortedPRs[0]?.branch
  if (!latestBranch) {
    return null
  }
  
  // Extract Jira task key from branch name (feature/JIRA-123 or bugfix/JIRA-123)
  const jiraMatch = latestBranch.match(/^(feature|bugfix)\/([A-Z]+-\d+)/i)
  if (jiraMatch) {
    return jiraMatch[2] // Return the Jira task key (e.g., "ROC-3921")
  }
  
  return null
}

/**
 * Gets the Jira URL for a specific issue
 * @param issueKey - The Jira issue key (e.g., "ROC-1234")
 * @returns The full Jira URL
 */
export function getJiraUrl(issueKey: string): string {
  const domain = process.env.NEXT_PUBLIC_JIRA_DOMAIN || process.env.JIRA_DOMAIN || 'your-domain.atlassian.net'
  return `https://${domain}/browse/${issueKey}`
}
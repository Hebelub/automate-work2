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
    case 'open':
    case 'todo':
      return 2
    case 'qa':
      return 3
    case 'on hold':
      return 4
    case 'done':
      return 5
    case 'ready for prod':
      return 6
    case 'rejected':
      return 7
    default:
      return 8 // Unknown status goes to bottom
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
 * Sorts tasks by priority (hidden status first, then status, then issue type)
 * @param tasks - Array of tasks to sort
 * @returns Sorted array of tasks
 */
export function sortTasksByPriority<T extends { status: string; issueType: string; hidden?: boolean }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    // First, compare by hidden status - hidden tasks go to bottom
    const hiddenA = a.hidden ? 1 : 0
    const hiddenB = b.hidden ? 1 : 0
    
    if (hiddenA !== hiddenB) {
      return hiddenA - hiddenB
    }
    
    // If both have same hidden status, compare by status priority
    const statusA = getStatusPriority(a.status)
    const statusB = getStatusPriority(b.status)
    
    if (statusA !== statusB) {
      return statusA - statusB
    }
    
    // If status is the same, compare by issue type priority
    const typeA = getIssueTypePriority(a.issueType)
    const typeB = getIssueTypePriority(b.issueType)
    
    return typeA - typeB
  })
}
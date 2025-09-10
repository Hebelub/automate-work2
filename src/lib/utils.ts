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
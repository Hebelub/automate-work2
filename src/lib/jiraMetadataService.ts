import { LocalGitStatus } from "@/types"

export type HiddenStatus = 'visible' | 'hidden' | 'hiddenUntilUpdated'

export interface JiraTaskMetadata {
  id: string
  parentTaskId?: string
  notes?: string
  hiddenStatus: HiddenStatus // Required field for hiding status
  hiddenUntilUpdatedDate?: string // ISO timestamp when "hide until updated" was set
  childTasksExpanded?: boolean
  pullRequestsExpanded?: boolean
  localBranchesExpanded?: boolean
}

export interface PullRequestMetadata {
  id: string
  hidden: boolean
  localGitStatus?: LocalGitStatus
}

const STORAGE_KEY = 'jira-task-metadata'
const PR_STORAGE_KEY = 'pull-request-metadata'

// Get all metadata from localStorage
export function getAllJiraMetadata(): Record<string, JiraTaskMetadata> {
  if (typeof window === 'undefined') {
    return {}
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const metadata = stored ? JSON.parse(stored) : {}
    
    // Ensure all metadata entries have the required hiddenStatus field
    const migratedMetadata: Record<string, JiraTaskMetadata> = {}
    for (const [taskId, taskMetadata] of Object.entries(metadata)) {
      migratedMetadata[taskId] = {
        ...(taskMetadata as JiraTaskMetadata),
        hiddenStatus: (taskMetadata as JiraTaskMetadata).hiddenStatus || 'visible'
      }
    }
    
    return migratedMetadata
  } catch (error) {
    console.error('Error reading JIRA metadata from localStorage:', error)
    return {}
  }
}

// Get metadata for a specific task
export function getJiraTaskMetadata(taskId: string): JiraTaskMetadata {
  const allMetadata = getAllJiraMetadata()
  return allMetadata[taskId] || {
    id: taskId,
    hiddenStatus: 'visible'
  }
}

// Save metadata for a specific task
export function saveJiraTaskMetadata(metadata: JiraTaskMetadata): void {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    const allMetadata = getAllJiraMetadata()
    allMetadata[metadata.id] = metadata
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allMetadata))
  } catch (error) {
    console.error('Error saving JIRA metadata to localStorage:', error)
  }
}

// Update specific fields for a task
export function updateJiraTaskMetadata(
  taskId: string, 
  updates: Partial<Omit<JiraTaskMetadata, 'id'>>
): void {
  const currentMetadata = getJiraTaskMetadata(taskId)
  const updatedMetadata = { ...currentMetadata, ...updates }
  saveJiraTaskMetadata(updatedMetadata)
}

// Toggle hidden status (legacy function for backward compatibility)
export function toggleTaskHidden(taskId: string): void {
  const currentMetadata = getJiraTaskMetadata(taskId)
  const newHiddenStatus = currentMetadata.hiddenStatus === 'visible' ? 'hidden' : 'visible'
  updateJiraTaskMetadata(taskId, { 
    hiddenStatus: newHiddenStatus,
    hiddenUntilUpdatedDate: undefined // Clear any "hide until updated" date
  })
}

// Set task to permanently hidden
export function hideTask(taskId: string): void {
  updateJiraTaskMetadata(taskId, { 
    hiddenStatus: 'hidden',
    hiddenUntilUpdatedDate: undefined
  })
}

// Set task to hidden until updated
export function hideTaskUntilUpdated(taskId: string): void {
  updateJiraTaskMetadata(taskId, { 
    hiddenStatus: 'hiddenUntilUpdated',
    hiddenUntilUpdatedDate: new Date().toISOString()
  })
}

// Show task (make visible)
export function showTask(taskId: string): void {
  updateJiraTaskMetadata(taskId, { 
    hiddenStatus: 'visible',
    hiddenUntilUpdatedDate: undefined
  })
}

// Check if task should be visible based on hidden status and update timestamps
export function shouldTaskBeVisible(task: { lastJiraUpdate?: string }, metadata: JiraTaskMetadata): boolean {
  if (metadata.hiddenStatus === 'visible') {
    return true
  }
  
  if (metadata.hiddenStatus === 'hidden') {
    return false
  }
  
  if (metadata.hiddenStatus === 'hiddenUntilUpdated') {
    // If no lastJiraUpdate, always show (as per user requirement)
    if (!task.lastJiraUpdate) {
      return true
    }
    
    // If no hiddenUntilUpdatedDate, show (shouldn't happen, but safety check)
    if (!metadata.hiddenUntilUpdatedDate) {
      return true
    }
    
    // Compare timestamps - show if Jira was updated after hiding
    const jiraUpdateTime = new Date(task.lastJiraUpdate).getTime()
    const hiddenTime = new Date(metadata.hiddenUntilUpdatedDate).getTime()
    
    return jiraUpdateTime > hiddenTime
  }
  
  // Default to visible for any unknown status
  return true
}

// Set parent task
export function setTaskParent(taskId: string, parentTaskId: string | undefined): void {
  updateJiraTaskMetadata(taskId, { parentTaskId })
}

// Set notes
export function setTaskNotes(taskId: string, notes: string): void {
  updateJiraTaskMetadata(taskId, { notes })
}

// Get all child tasks for a parent
export function getChildTasks(parentTaskId: string): string[] {
  const allMetadata = getAllJiraMetadata()
  return Object.values(allMetadata)
    .filter(metadata => metadata.parentTaskId === parentTaskId)
    .map(metadata => metadata.id)
}

// Remove all metadata for a task (cleanup)
export function removeJiraTaskMetadata(taskId: string): void {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    const allMetadata = getAllJiraMetadata()
    delete allMetadata[taskId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allMetadata))
  } catch (error) {
    console.error('Error removing JIRA metadata from localStorage:', error)
  }
}

// Check if setting a parent would create a loop
export function wouldCreateLoop(taskId: string, newParentId: string): boolean {
  if (taskId === newParentId) {
    return true // Can't be parent of itself
  }
  
  const allMetadata = getAllJiraMetadata()
  let currentParent: string | undefined = newParentId
  
  // Follow the parent chain to see if we'd create a loop
  while (currentParent) {
    if (currentParent === taskId) {
      return true // Found a loop
    }
    const parentMetadata: JiraTaskMetadata | undefined = allMetadata[currentParent]
    currentParent = parentMetadata?.parentTaskId
  }
  
  return false
}

// Toggle child tasks section expanded state
export function toggleChildTasksExpanded(taskId: string): void {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    const metadata = getAllJiraMetadata()
    const currentMetadata = metadata[taskId] || { 
      id: taskId, 
      hidden: false, 
      childTasksExpanded: true, 
      pullRequestsExpanded: true,
      localBranchesExpanded: true
    }
    const newExpanded = !currentMetadata.childTasksExpanded
    
    metadata[taskId] = {
      ...currentMetadata,
      childTasksExpanded: newExpanded
      // Note: We don't touch pullRequestsExpanded here - it stays as it was
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata))
  } catch (error) {
    console.error('Error toggling child tasks expanded state:', error)
  }
}

// Toggle pull requests section expanded state
export function togglePullRequestsExpanded(taskId: string): void {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    const metadata = getAllJiraMetadata()
    const currentMetadata = metadata[taskId] || { 
      id: taskId, 
      hidden: false, 
      childTasksExpanded: true, 
      pullRequestsExpanded: true,
      localBranchesExpanded: true
    }
    const newExpanded = !currentMetadata.pullRequestsExpanded
    
    metadata[taskId] = {
      ...currentMetadata,
      pullRequestsExpanded: newExpanded
      // Note: We don't touch childTasksExpanded here - it stays as it was
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata))
  } catch (error) {
    console.error('Error toggling pull requests expanded state:', error)
  }
}

// Clear all metadata (for debugging)
export function clearAllMetadata(): void {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(PR_STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing metadata from localStorage:', error)
  }
}

// Pull Request Metadata Functions

// Get all PR metadata from localStorage
export function getAllPRMetadata(): Record<string, PullRequestMetadata> {
  if (typeof window === 'undefined') {
    return {}
  }
  
  try {
    const stored = localStorage.getItem(PR_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('Error loading PR metadata from localStorage:', error)
    return {}
  }
}

// Get metadata for a specific PR
export function getPRMetadata(prId: string): PullRequestMetadata {
  const allMetadata = getAllPRMetadata()
  return allMetadata[prId] || { id: prId, hidden: false }
}

// Save PR metadata to localStorage
export function savePRMetadata(metadata: PullRequestMetadata): void {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    const allMetadata = getAllPRMetadata()
    allMetadata[metadata.id] = metadata
    localStorage.setItem(PR_STORAGE_KEY, JSON.stringify(allMetadata))
  } catch (error) {
    console.error('Error saving PR metadata to localStorage:', error)
  }
}

// Update specific fields for a PR
export function updatePRMetadata(
  prId: string, 
  updates: Partial<Omit<PullRequestMetadata, 'id'>>
): void {
  const currentMetadata = getPRMetadata(prId)
  const updatedMetadata = { ...currentMetadata, ...updates }
  savePRMetadata(updatedMetadata)
}

// Toggle PR hidden state
export function togglePRHidden(prId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const metadata = getAllPRMetadata()
    const currentMetadata = metadata[prId] || { id: prId, hidden: false }
    const newHidden = !currentMetadata.hidden

    metadata[prId] = {
      ...currentMetadata,
      hidden: newHidden
    }

    localStorage.setItem(PR_STORAGE_KEY, JSON.stringify(metadata))
  } catch (error) {
    console.error('Error toggling PR hidden state:', error)
  }
}

// Update PR git status
export function updatePRGitStatus(prId: string, gitStatus: LocalGitStatus): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const metadata = getAllPRMetadata()
    const currentMetadata = metadata[prId] || { id: prId, hidden: false }

    metadata[prId] = {
      ...currentMetadata,
      localGitStatus: gitStatus
    }

    localStorage.setItem(PR_STORAGE_KEY, JSON.stringify(metadata))
  } catch (error) {
    console.error('Error updating PR git status:', error)
  }
}


// Clear PR git status
export function clearPRGitStatus(prId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const metadata = getAllPRMetadata()
    const currentMetadata = metadata[prId]

    if (currentMetadata) {
      delete currentMetadata.localGitStatus
      metadata[prId] = currentMetadata
      localStorage.setItem(PR_STORAGE_KEY, JSON.stringify(metadata))
    }
  } catch (error) {
    console.error('Error clearing PR git status:', error)
  }
}

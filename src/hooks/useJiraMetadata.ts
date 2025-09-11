import { useState, useEffect } from 'react'
import { JiraTaskMetadata, getAllJiraMetadata, updateJiraTaskMetadata, shouldTaskBeVisible } from '@/lib/jiraMetadataService'
import { TaskWithPRs } from '@/types'

export function useJiraMetadata(tasks: TaskWithPRs[]) {
  const [metadata, setMetadata] = useState<Record<string, JiraTaskMetadata>>({})

  useEffect(() => {
    // Load metadata from localStorage
    const allMetadata = getAllJiraMetadata()
    setMetadata(allMetadata)
  }, [])

  // Function to update metadata
  const updateMetadata = (taskId: string, updates: Partial<JiraTaskMetadata>) => {
    // Save to localStorage first
    updateJiraTaskMetadata(taskId, updates)
    
    // Then update React state
    setMetadata(prev => {
      const existingMetadata = prev[taskId] || {
        id: taskId,
        hiddenStatus: 'visible' as const,
        childTasksExpanded: true,
        pullRequestsExpanded: true
      }
      
      const updated = {
        ...prev,
        [taskId]: {
          ...existingMetadata,
          ...updates
        }
      }
      return updated
    })
  }

  // Shared sorting function for both root and child tasks
  const sortTasksByPriority = (tasks: TaskWithPRs[]): TaskWithPRs[] => {
    return tasks.sort((a, b) => {
      const aMetadata = metadata[a.id] || { id: a.id, hiddenStatus: 'visible' as const }
      const bMetadata = metadata[b.id] || { id: b.id, hiddenStatus: 'visible' as const }

      // Use actual visibility logic instead of just hiddenStatus
      const aVisible = shouldTaskBeVisible(a, aMetadata)
      const bVisible = shouldTaskBeVisible(b, bMetadata)

      // Priority 1 (top): actually visible tasks
      // Priority 2 (middle): paused tasks (hiddenUntilUpdated but not yet updated)
      // Priority 3 (bottom): permanently hidden tasks

      if (aVisible && !bVisible) return -1
      if (!aVisible && bVisible) return 1

      // If both have same visibility, sort by hiddenStatus for paused vs hidden
      if (!aVisible && !bVisible) {
        if (aMetadata.hiddenStatus === 'hiddenUntilUpdated' && bMetadata.hiddenStatus === 'hidden') return -1
        if (aMetadata.hiddenStatus === 'hidden' && bMetadata.hiddenStatus === 'hiddenUntilUpdated') return 1
      }

      // If same priority, maintain original order
      return 0
    })
  }

  // Function to get tasks with metadata applied
  const getTasksWithMetadata = (): TaskWithPRs[] => {
    const processedTasks = tasks.map(task => {
      const taskMetadata = metadata[task.id] || {
        id: task.id,
        hiddenStatus: 'visible' as const,
        childTasksExpanded: true,
        pullRequestsExpanded: true
      }
      
      // Apply visibility logic based on new hidden status
      const isVisible = shouldTaskBeVisible(task, taskMetadata)
      
      // Update the task's hiddenStatus to reflect actual visibility
      const effectiveHiddenStatus = isVisible ? 'visible' : taskMetadata.hiddenStatus
      
      // Get child tasks by filtering all tasks that have this task as their parent
      const childTasks = tasks
        .filter(childTask => {
          const childMetadata = metadata[childTask.id] || { id: childTask.id, hiddenStatus: 'visible' as const }
          return childMetadata.parentTaskId === task.id
        })
        .map(childTask => {
          const childMetadata = metadata[childTask.id] || {
            id: childTask.id,
            hiddenStatus: 'visible' as const,
            childTasksExpanded: true,
            pullRequestsExpanded: true
          }
          // Apply visibility logic to child tasks too
          const childIsVisible = shouldTaskBeVisible(childTask, childMetadata)
          const childEffectiveHiddenStatus = childIsVisible ? 'visible' : childMetadata.hiddenStatus
          return {
            ...childTask,
            ...childMetadata,
            hiddenStatus: childEffectiveHiddenStatus // Use the effective visibility status
          }
        })
      
      // Sort child tasks using shared sorting function
      const sortedChildTasks = sortTasksByPriority(childTasks)

      return {
        ...task,
        ...taskMetadata,
        hiddenStatus: effectiveHiddenStatus, // Use the effective visibility status
        childTasks: sortedChildTasks.length > 0 ? sortedChildTasks : undefined
      }
    })
    
    // Sort all processed tasks using shared sorting function
    return sortTasksByPriority(processedTasks)
  }

  // Function to get only root tasks (tasks without parents)
  const getRootTasksWithMetadata = (): TaskWithPRs[] => {
    // First, process ALL tasks with metadata
    const allProcessedTasks = getTasksWithMetadata()
    
    // Then filter for root tasks (tasks without parents) from the processed tasks
    const rootTasks = allProcessedTasks.filter(task => {
      const taskMetadata = metadata[task.id] || { id: task.id, hiddenStatus: 'visible' as const }
      return !taskMetadata.parentTaskId
    })
    
    // Sort root tasks using shared sorting function
    return sortTasksByPriority(rootTasks)
  }

  return {
    metadata,
    updateMetadata,
    getTasksWithMetadata,
    getRootTasksWithMetadata
  }
}

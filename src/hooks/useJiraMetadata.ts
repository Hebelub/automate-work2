import { useState, useEffect } from 'react'
import { JiraTaskMetadata, getAllJiraMetadata } from '@/lib/jiraMetadataService'
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
    setMetadata(prev => {
      const updated = {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          id: taskId,
          hidden: false,
          childTasksExpanded: true,
          pullRequestsExpanded: true,
          ...updates
        }
      }
      return updated
    })
  }

  // Function to get tasks with metadata applied
  const getTasksWithMetadata = (): TaskWithPRs[] => {
    return tasks.map(task => {
      const taskMetadata = metadata[task.id] || {
        id: task.id,
        hidden: false,
        childTasksExpanded: true,
        pullRequestsExpanded: true
      }
      
      // Get child tasks by filtering all tasks that have this task as their parent
      const childTasks = tasks
        .filter(childTask => {
          const childMetadata = metadata[childTask.id] || { id: childTask.id, hidden: false }
          return childMetadata.parentTaskId === task.id
        })
        .map(childTask => {
          const childMetadata = metadata[childTask.id] || {
            id: childTask.id,
            hidden: false,
            childTasksExpanded: true,
            pullRequestsExpanded: true
          }
          return {
            ...childTask,
            ...childMetadata
          }
        })
        .sort((a, b) => {
          // Sort so hidden child tasks appear at the bottom
          if (a.hidden && !b.hidden) return 1
          if (!a.hidden && b.hidden) return -1
          return 0
        })

      return {
        ...task,
        ...taskMetadata,
        childTasks: childTasks.length > 0 ? childTasks : undefined
      }
    })
  }

  // Function to get only root tasks (tasks without parents)
  const getRootTasksWithMetadata = (): TaskWithPRs[] => {
    const allTasksWithMetadata = getTasksWithMetadata()
    
    // Filter out tasks that have a parent (child tasks)
    const rootTasks = allTasksWithMetadata.filter(task => {
      const taskMetadata = metadata[task.id] || { id: task.id, hidden: false, childTasksExpanded: true, pullRequestsExpanded: true }
      return !taskMetadata.parentTaskId
    })
    
    // Sort so hidden tasks appear at the bottom
    return rootTasks.sort((a, b) => {
      const aMetadata = metadata[a.id] || { id: a.id, hidden: false }
      const bMetadata = metadata[b.id] || { id: b.id, hidden: false }
      
      // If one is hidden and the other isn't, hidden goes to bottom
      if (aMetadata.hidden && !bMetadata.hidden) return 1
      if (!aMetadata.hidden && bMetadata.hidden) return -1
      
      // If both have same hidden status, maintain original order
      return 0
    })
  }

  return {
    metadata,
    updateMetadata,
    getTasksWithMetadata,
    getRootTasksWithMetadata
  }
}

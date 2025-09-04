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
        hidden: false
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
            hidden: false
          }
          return {
            ...childTask,
            ...childMetadata
          }
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
    return allTasksWithMetadata.filter(task => {
      const taskMetadata = metadata[task.id] || { id: task.id, hidden: false }
      return !taskMetadata.parentTaskId
    })
  }

  return {
    metadata,
    updateMetadata,
    getTasksWithMetadata,
    getRootTasksWithMetadata
  }
}

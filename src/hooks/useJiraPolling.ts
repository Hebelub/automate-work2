import { useState, useEffect, useCallback } from 'react'
import { TaskWithPRs } from '@/types'

interface UseJiraPollingReturn {
  tasks: TaskWithPRs[]
  setTasks: React.Dispatch<React.SetStateAction<TaskWithPRs[]>>
  jiraHasChanges: boolean
  setJiraHasChanges: React.Dispatch<React.SetStateAction<boolean>>
  lastJiraCheck: Date | null
  setLastJiraCheck: React.Dispatch<React.SetStateAction<Date | null>>
}

export function useJiraPolling(
  initialTasks: TaskWithPRs[],
  loading: boolean
): UseJiraPollingReturn {
  const [tasks, setTasks] = useState<TaskWithPRs[]>(initialTasks)
  const [jiraHasChanges, setJiraHasChanges] = useState(false)
  const [lastJiraCheck, setLastJiraCheck] = useState<Date | null>(null)

  // Background JIRA polling every 15 seconds
  useEffect(() => {
    const checkJiraChanges = async () => {
      try {
        console.log('Background JIRA check...')
        
        const response = await fetch("/api/dashboard")
        if (response.ok) {
          const data = await response.json()
          const newTasks = data.tasks || []
          
          // Always update tasks and check for changes
          setTasks(prevTasks => {
            // Check if tasks have changed by comparing all relevant JIRA fields
            const newTaskData = newTasks.map((t: TaskWithPRs) => ({ 
              key: t.key, 
              status: t.status,
              name: t.name,
              description: t.description,
              assignee: t.assignee,
              priority: t.priority,
              issueType: t.issueType,
              isInSprint: t.isInSprint
            }))
            const prevTaskData = prevTasks.map((t: TaskWithPRs) => ({ 
              key: t.key, 
              status: t.status,
              name: t.name,
              description: t.description,
              assignee: t.assignee,
              priority: t.priority,
              issueType: t.issueType,
              isInSprint: t.isInSprint
            }))
            
            console.log('Previous tasks:', prevTaskData)
            console.log('New tasks:', newTaskData)
            
            // Check for changes in multiple ways
            const hasTaskChanges = JSON.stringify(newTaskData) !== JSON.stringify(prevTaskData)
            const hasCountChanges = newTasks.length !== prevTasks.length
            const hasNewTasks = newTasks.some((newTask: TaskWithPRs) => !prevTasks.some((prevTask: TaskWithPRs) => prevTask.key === newTask.key))
            const hasRemovedTasks = prevTasks.some((prevTask: TaskWithPRs) => !newTasks.some((newTask: TaskWithPRs) => newTask.key === prevTask.key))
            
            const hasChanges = hasTaskChanges || hasCountChanges || hasNewTasks || hasRemovedTasks
            
            if (hasChanges) {
              console.log('JIRA tasks have changed, updating...')
              if (hasCountChanges) console.log('Task count changed:', prevTasks.length, '->', newTasks.length)
              if (hasNewTasks) console.log('New tasks detected')
              if (hasRemovedTasks) console.log('Tasks removed')
              if (hasTaskChanges) console.log('Existing tasks modified')
              setJiraHasChanges(true)
            } else {
              console.log('No JIRA changes detected')
            }
            
            // Merge new tasks with existing local branches to preserve them
            const mergedTasks = newTasks.map((newTask: TaskWithPRs) => {
              const existingTask = prevTasks.find(prevTask => prevTask.key === newTask.key)
              if (existingTask && existingTask.localBranches) {
                return {
                  ...newTask,
                  localBranches: existingTask.localBranches
                }
              }
              return newTask
            })
            
            return mergedTasks
          })
          
          setLastJiraCheck(new Date())
        }
      } catch (err) {
        console.error('Background JIRA check failed:', err)
      }
    }

    // Start polling after initial load
    if (!loading) {
      const interval = setInterval(checkJiraChanges, 30000) // 30 seconds
      
      return () => clearInterval(interval)
    }
  }, [loading])

  return {
    tasks,
    setTasks,
    jiraHasChanges,
    setJiraHasChanges,
    lastJiraCheck,
    setLastJiraCheck
  }
}

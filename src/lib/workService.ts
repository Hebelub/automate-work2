import { TaskWithPRs, JiraTask, GitHubPR } from "@/types"
import { fetchJiraTasks } from "./jiraService"
import { fetchPullRequests, clearActiveReposCache } from "./githubService"

// Cache for PRs to avoid refetching
let cachedPRs: GitHubPR[] = []
let cachedPRsTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getTasksWithPRs(selectedRepo?: string): Promise<TaskWithPRs[]> {
  try {
    console.log('Starting to fetch work data...')
    
    // Check if we need to fetch PRs (cache expired or different repo selected)
    const now = Date.now()
    const shouldFetchPRs = !cachedPRs.length || 
                    (now - cachedPRsTimestamp > CACHE_DURATION) ||
                    (selectedRepo && selectedRepo !== 'all' && !cachedPRs.some(pr => pr.repository?.toLowerCase() === selectedRepo.toLowerCase()))
    
    let allPRs: GitHubPR[]
    
    if (shouldFetchPRs) {
      console.log('Fetching fresh PR data...')
      allPRs = await fetchPullRequests(selectedRepo)
      cachedPRs = allPRs
      cachedPRsTimestamp = now
         } else {
       console.log('Using cached PR data...')
             allPRs = selectedRepo && selectedRepo !== 'all'
        ? cachedPRs.filter(pr => pr.repository?.toLowerCase() === selectedRepo.toLowerCase())
        : cachedPRs
     }
    
    // Fetch JIRA tasks
    const jiraTasks = await fetchJiraTasks()

    console.log(`Fetched ${jiraTasks.length} JIRA tasks and using ${allPRs.length} PRs`)

    // Combine tasks with their linked PRs
    const tasksWithPRs = jiraTasks.map(task => {
      const linkedPRs = allPRs.filter(pr => pr.linkedTaskKey === task.key)
      if (linkedPRs.length > 0) {
        console.log(`Task ${task.key} has ${linkedPRs.length} linked PRs:`, linkedPRs.map(pr => `#${pr.number} (${pr.repository})`))
      }
      
      return {
        ...task,
        pullRequests: linkedPRs
      }
    })

    const tasksWithPRsCount = tasksWithPRs.filter(task => task.pullRequests.length > 0).length
    console.log(`Total tasks with linked PRs: ${tasksWithPRsCount}`)

    return tasksWithPRs
  } catch (error) {
    console.error('Error fetching work data:', error)
    return []
  }
}



export async function getTasksByStatus(status: JiraTask['status']): Promise<TaskWithPRs[]> {
  const allTasks = await getTasksWithPRs()
  return allTasks.filter(task => task.status === status)
}

// Function to clear PR cache (useful for testing or manual refresh)
export function clearPRCache(): void {
  cachedPRs = []
  cachedPRsTimestamp = 0
  clearActiveReposCache() // Also clear the active repos cache
  console.log('PR cache and active repos cache cleared')
}

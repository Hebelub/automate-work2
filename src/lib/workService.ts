import { TaskWithPRs, JiraTask, GitHubPR } from "@/types"
import { fetchJiraTasks } from "./jiraService"
import { fetchPullRequests, clearActiveReposCache, checkGitHubRateLimit } from "./githubService"

// Cache for PRs to avoid refetching
let cachedPRs: GitHubPR[] = []
let cachedPRsTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getTasksWithPRs(selectedRepo?: string): Promise<TaskWithPRs[]> {
  try {
    console.log('Starting to fetch work data...')
    
    // Check GitHub rate limit first
    const rateLimitBefore = await checkGitHubRateLimit()
    
    // Check if we need to fetch PRs (cache expired or different repo selected)
    const now = Date.now()
    const shouldFetchPRs = !cachedPRs.length || 
                    (now - cachedPRsTimestamp > CACHE_DURATION) ||
                    (selectedRepo && selectedRepo !== 'all' && !cachedPRs.some(pr => pr.repository?.toLowerCase() === selectedRepo.toLowerCase()))
    
    let allPRs: GitHubPR[]
    
    // Only fetch fresh PR data if we're not rate limited
    if (shouldFetchPRs && !rateLimitBefore.isRateLimited) {
      console.log('Fetching fresh PR data...')
      allPRs = await fetchPullRequests(selectedRepo)
      cachedPRs = allPRs
      cachedPRsTimestamp = now
    } else if (rateLimitBefore.isRateLimited) {
      console.warn(`GitHub API rate limit reached. Using cached data. Reset time: ${rateLimitBefore.resetTime?.toISOString()}`)
      
      // If no cached data and rate limited, try to fetch anyway (for testing)
      if (cachedPRs.length === 0) {
        console.warn('⚠️  No cached data available and rate limited. Attempting to fetch anyway...')
        try {
          allPRs = await fetchPullRequests(selectedRepo)
          cachedPRs = allPRs
          cachedPRsTimestamp = now
        } catch (error) {
          console.error('❌ Failed to fetch data due to rate limit:', error)
          allPRs = []
        }
      } else {
        allPRs = selectedRepo && selectedRepo !== 'all'
          ? cachedPRs.filter(pr => pr.repository?.toLowerCase() === selectedRepo.toLowerCase())
          : cachedPRs
      }
    } else {
      allPRs = selectedRepo && selectedRepo !== 'all'
        ? cachedPRs.filter(pr => pr.repository?.toLowerCase() === selectedRepo.toLowerCase())
        : cachedPRs
    }
    
    // Fetch JIRA tasks
    const jiraTasks = await fetchJiraTasks()

    console.log(`Fetched ${jiraTasks.length} JIRA tasks and using ${allPRs.length} PRs`)

    // Combine tasks with their linked PRs
    const tasksWithPRs = jiraTasks.map(task => {
      const linkedPRs = allPRs.filter(pr => pr.linkedTaskKey?.toLowerCase() === task.key.toLowerCase())
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

    // Check GitHub rate limit after API calls
    const rateLimitAfter = await checkGitHubRateLimit()

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

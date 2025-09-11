import { TaskWithPRs, JiraTask, GitHubPR, ReviewGitHubPR, LocalBranch } from "@/types"
import { fetchJiraTasks } from "./jiraService"
import { fetchPullRequests, clearActiveReposCache, checkGitHubRateLimit, fetchPRsNeedingReview } from "./githubService"
import { getJiraTaskMetadata, getChildTasks, getPRMetadata } from "./jiraMetadataService"

// Cache for PRs to avoid refetching
let cachedPRs: GitHubPR[] = []
let cachedPRsTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Helper function to apply PR metadata to PRs
function applyPRMetadata(prs: GitHubPR[]): (GitHubPR & any)[] {
  return prs.map(pr => {
    const metadata = getPRMetadata(pr.id)
    return {
      ...pr,
      ...metadata
    }
  })
}

// Helper function to fetch ALL local branches from all repositories
async function fetchAllLocalBranches(): Promise<LocalBranch[]> {
  try {
    // Import the function directly since we're on the server side
    const { getAllLocalBranches } = await import('@/app/api/local-git/route')
    const branches = await getAllLocalBranches()
    return branches as LocalBranch[]
  } catch (error) {
    console.error('Error fetching all local branches:', error)
    return []
  }
}

// Helper function to fetch local branches only for specific task keys (much more efficient!)
async function fetchAllLocalBranchesForTaskKeys(taskKeys: string[]): Promise<LocalBranch[]> {
  try {
    // Import the function directly since we're on the server side
    const { getLocalBranchesForTaskKeys } = await import('@/app/api/local-git/route')
    const branches = await getLocalBranchesForTaskKeys(taskKeys)
    return branches as LocalBranch[]
  } catch (error) {
    console.error('Error fetching local branches for task keys:', error)
    return []
  }
}

// Helper function to filter branches by task key
function filterBranchesByTaskKey(branches: LocalBranch[], taskKey: string): LocalBranch[] {
  // Create case-insensitive regex for the task key
  const taskKeyRegex = new RegExp(taskKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  
  return branches.filter(branch => {
    return taskKeyRegex.test(branch.branch)
  })
}

// Function to get PRs needing review
export async function getPRsNeedingReview(): Promise<ReviewGitHubPR[]> {
  try {
    console.log('Fetching PRs needing review...')
    const reviewPRs = await fetchPRsNeedingReview()
    console.log(`Found ${reviewPRs.length} PRs needing review`)
    return reviewPRs
  } catch (error) {
    console.error('Error fetching PRs needing review:', error)
    return []
  }
}

// Fast function to load ONLY JIRA tasks + PRs (no Git operations)
export async function getTasksWithPRs(selectedRepo?: string): Promise<TaskWithPRs[]> {
  try {
    console.log('Phase 1: Loading JIRA tasks + PRs (fast)...')
    
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

    // Combine tasks with their linked PRs and metadata (NO local branches)
    const tasksWithPRs = jiraTasks.map(task => {
      const linkedPRs = applyPRMetadata(allPRs.filter(pr => pr.linkedTaskKey?.toLowerCase() === task.key.toLowerCase()))
      if (linkedPRs.length > 0) {
        console.log(`Task ${task.key} has ${linkedPRs.length} linked PRs:`, linkedPRs.map(pr => `#${pr.number} (${pr.repository})`))
      }

      // Get metadata for this task
      const metadata = getJiraTaskMetadata(task.id)

      // Get child tasks (without local branches)
      const childTaskIds = getChildTasks(task.id)
      const childTasks = jiraTasks.filter(childTask => childTaskIds.includes(childTask.id)).map(childTask => {
        const childLinkedPRs = applyPRMetadata(allPRs.filter(pr => pr.linkedTaskKey?.toLowerCase() === childTask.key.toLowerCase()))
        const childMetadata = getJiraTaskMetadata(childTask.id)
        return {
          ...childTask,
          ...childMetadata,
          pullRequests: childLinkedPRs,
          // Ensure these fields are available
          parentTaskId: childMetadata.parentTaskId,
          notes: childMetadata.notes,
          hiddenStatus: childMetadata.hiddenStatus,
          hiddenUntilUpdatedDate: childMetadata.hiddenUntilUpdatedDate,
          childTasksExpanded: childMetadata.childTasksExpanded,
          pullRequestsExpanded: childMetadata.pullRequestsExpanded,
          localBranchesExpanded: childMetadata.localBranchesExpanded
        }
      })

      return {
        ...task,
        ...metadata,
        pullRequests: linkedPRs,
        childTasks: childTasks.length > 0 ? childTasks : undefined,
        // Ensure these fields are available
        parentTaskId: metadata.parentTaskId,
        notes: metadata.notes,
        hiddenStatus: metadata.hiddenStatus,
        hiddenUntilUpdatedDate: metadata.hiddenUntilUpdatedDate,
        childTasksExpanded: metadata.childTasksExpanded,
        pullRequestsExpanded: metadata.pullRequestsExpanded,
        localBranchesExpanded: metadata.localBranchesExpanded
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

// Function to combine tasks with local branches (Phase 2)
export async function combineTasksWithLocalBranches(tasks: TaskWithPRs[]): Promise<TaskWithPRs[]> {
  try {
    console.log('Phase 2: Loading local branches and combining with tasks...')
    
    // Extract all unique task keys from tasks and child tasks
    const allTaskKeys = new Set<string>()
    tasks.forEach(task => {
      allTaskKeys.add(task.key)
      task.childTasks?.forEach(childTask => {
        allTaskKeys.add(childTask.key)
      })
    })
    
    const taskKeysArray = Array.from(allTaskKeys)
    console.log(`Looking for branches matching ${taskKeysArray.length} task keys:`, taskKeysArray)
    
    // Fetch local branches only for relevant task keys (much more efficient!)
    const allLocalBranches = await fetchAllLocalBranchesForTaskKeys(taskKeysArray)
    console.log(`Found ${allLocalBranches.length} total local branches matching task keys`)

    // Combine tasks with local branches
    const tasksWithBranches = tasks.map(task => {
      // Filter local branches for this specific task
      const taskLocalBranches = filterBranchesByTaskKey(allLocalBranches, task.key)
      
      // Filter out branches that already have corresponding PRs
      const localBranches = taskLocalBranches.filter(localBranch => {
        const hasCorrespondingPR = task.pullRequests.some(pr => {
          // Compare branch names
          if (pr.branch !== localBranch.branch) return false
          
          // Compare repository names - handle both direct matches and remote origin matches
          if (pr.repository === localBranch.repository) return true
          
          // Check if the PR repository matches the local branch repository's remote origin
          // PR repository format: "owner/repo" (e.g., "tfso/website-accounting")
          // Local repository: directory name (e.g., "website-accounting" or "feature-history-tab")
          const prRepoName = pr.repository?.split('/').pop() // Extract repo name from "owner/repo"
          
          // Direct repository name match
          if (prRepoName === localBranch.repository) return true
          
          // Check if the local branch's remote origin matches the PR repository
          if (localBranch.remoteOrigin) {
            // Extract owner/repo from remote origin URL (e.g., "https://github.com/tfso/website-accounting.git")
            const remoteMatch = localBranch.remoteOrigin.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
            if (remoteMatch) {
              const [, owner, repo] = remoteMatch
              const remoteRepoName = `${owner}/${repo}`
              if (remoteRepoName === pr.repository) return true
            }
          }
          
          return false
        })
        
        return !hasCorrespondingPR
      })
      
      if (localBranches.length > 0) {
        console.log(`Task ${task.key} has ${localBranches.length} local branches:`, localBranches.map(b => `${b.branch} (${b.repository})`))
      }

      // Process child tasks with local branches
      const childTasksWithBranches = task.childTasks?.map(childTask => {
        const childLocalBranches = filterBranchesByTaskKey(allLocalBranches, childTask.key).filter(localBranch => {
          const hasCorrespondingPR = childTask.pullRequests.some(pr => {
            // Compare branch names
            if (pr.branch !== localBranch.branch) return false
            
            // Compare repository names - handle both direct matches and remote origin matches
            if (pr.repository === localBranch.repository) return true
            
            // Check if the PR repository matches the local branch repository's remote origin
            const prRepoName = pr.repository?.split('/').pop()
            
            // Direct repository name match
            if (prRepoName === localBranch.repository) return true
            
            // Check if the local branch's remote origin matches the PR repository
            if (localBranch.remoteOrigin) {
              const remoteMatch = localBranch.remoteOrigin.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
              if (remoteMatch) {
                const [, owner, repo] = remoteMatch
                const remoteRepoName = `${owner}/${repo}`
                if (remoteRepoName === pr.repository) return true
              }
            }
            
            return false
          })
          return !hasCorrespondingPR
        })

        return {
          ...childTask,
          localBranches: childLocalBranches.length > 0 ? childLocalBranches : undefined
        }
      })

      return {
        ...task,
        localBranches: localBranches.length > 0 ? localBranches : undefined,
        childTasks: childTasksWithBranches
      }
    })

    return tasksWithBranches
  } catch (error) {
    console.error('Error combining tasks with local branches:', error)
    return tasks
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
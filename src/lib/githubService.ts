import { GitHubPR } from "@/types"

// For now, we'll need to add GitHub token to .env.local
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

if (!GITHUB_TOKEN) {
  console.warn('GitHub environment variables are not configured. Add GITHUB_TOKEN to .env.local')
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  private: boolean
  description: string | null
  html_url: string
}

export async function fetchUserRepositories(): Promise<GitHubRepo[]> {
  if (!GITHUB_TOKEN) {
    console.warn('GitHub credentials not configured, returning empty array')
    return []
  }

  console.log('GitHub token is configured, length:', GITHUB_TOKEN.length)
  console.log('GitHub token starts with:', GITHUB_TOKEN.substring(0, 10) + '...')

  try {
    console.log('Fetching user repositories from GitHub...')
    
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=100&sort=updated&direction=desc`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`GitHub API error: ${response.status} ${response.statusText}`)
      console.error('Error details:', errorText)
      console.error('Request URL:', `https://api.github.com/user/repos?per_page=100&sort=updated&direction=desc`)
      console.error('Headers:', {
        'Authorization': `token ${GITHUB_TOKEN ? '***' : 'MISSING'}`,
        'Accept': 'application/vnd.github.v3+json',
      })
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`Fetched ${data.length} repositories from GitHub`)
    
    return data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      description: repo.description,
      html_url: repo.html_url,
    }))
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error)
    return []
  }
}

// Cache for repositories that have linked PRs
let cachedActiveRepos: string[] = []
let cachedActiveReposTimestamp = 0
const ACTIVE_REPOS_CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

export async function fetchPullRequests(repoFullName?: string): Promise<GitHubPR[]> {
  if (!GITHUB_TOKEN) {
    console.warn('GitHub credentials not configured, returning empty array')
    return []
  }

  try {
    if (repoFullName) {
      // Fetch from specific repository
      console.log(`Fetching PRs from GitHub repo: ${repoFullName}`)
      return await fetchPRsFromRepo(repoFullName)
    } else {
      // Smart fetching: only fetch from repositories that have linked PRs
      console.log('Smart fetching PRs from active repositories...')
      
      // Check if we need to refresh the active repos cache
      const now = Date.now()
      if (!cachedActiveRepos.length || (now - cachedActiveReposTimestamp > ACTIVE_REPOS_CACHE_DURATION)) {
        console.log('Refreshing active repositories cache...')
        await refreshActiveReposCache()
      }
      
      if (cachedActiveRepos.length === 0) {
        console.log('No active repositories found, returning empty array')
        return []
      }
      
      console.log(`Fetching PRs from ${cachedActiveRepos.length} active repositories:`, cachedActiveRepos)
      
      // Fetch PRs from active repositories in parallel
      const prPromises = cachedActiveRepos.map(repo => fetchPRsFromRepo(repo))
      const results = await Promise.all(prPromises)
      
      const allPRs: GitHubPR[] = []
      results.forEach(prs => allPRs.push(...prs))
      
      console.log(`Total PRs fetched from active repositories: ${allPRs.length}`)
      const linkedPRs = allPRs.filter(pr => pr.linkedTaskKey)
      console.log(`Total PRs linked to JIRA tasks: ${linkedPRs.length}`)
      
      return allPRs
    }
  } catch (error) {
    console.error('Error fetching GitHub PRs:', error)
    return []
  }
}

async function fetchPRsFromRepo(repoFullName: string): Promise<GitHubPR[]> {
  let apiCallCount = 0
  try {
    console.log(`🔍 Fetching PRs from GitHub repo: ${repoFullName}`)
    apiCallCount++
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/pulls?state=all&per_page=100&sort=updated&direction=desc`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.error(`Failed to fetch PRs from ${repoFullName}: ${response.status}`)
      return []
    }

    const data = await response.json()
    console.log(`✅ Fetched ${data.length} PRs from ${repoFullName}`)
    console.log(`PR branch names:`, data.map((pr: any) => pr.head.ref))
    
    const prs = await Promise.all(data.map(async (pr: any) => {
      const linkedTaskKey = extractTaskKeyFromBranch(pr.head.ref)
      const prStatus = pr.merged_at ? 'merged' : pr.state
      
      // Only fetch review data for open PRs
      let reviewStatus: 'pending' | 'approved' | 'changes_requested' | 'no_reviews' = 'no_reviews'
      let requestedReviewers: string[] = []
      let approvedReviewers: string[] = []
      
      if (prStatus === 'open') {
        try {
          apiCallCount++
          const reviewsResponse = await fetch(
            `https://api.github.com/repos/${repoFullName}/pulls/${pr.number}/reviews`,
            {
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          )
          
          if (reviewsResponse.ok) {
            const reviews = await reviewsResponse.json()
            
            // Get requested reviewers
            if (pr.requested_reviewers) {
              requestedReviewers = pr.requested_reviewers.map((reviewer: any) => reviewer.login)
            }
            
            // Process review status
            if (reviews.length > 0) {
              const latestReviews = new Map()
              reviews.forEach((review: any) => {
                latestReviews.set(review.user.login, review.state)
              })
              
              const hasApprovals = Array.from(latestReviews.values()).some((state: string) => state === 'approved')
              const hasChangesRequested = Array.from(latestReviews.values()).some((state: string) => state === 'changes_requested')
              
              if (hasChangesRequested) {
                reviewStatus = 'changes_requested'
              } else if (hasApprovals) {
                reviewStatus = 'approved'
              } else {
                reviewStatus = 'pending'
              }
              
              // Get approved reviewers
              approvedReviewers = Array.from(latestReviews.entries())
                .filter(([_, state]) => state === 'approved')
                .map(([reviewer, _]) => reviewer)
            } else if (requestedReviewers.length > 0) {
              reviewStatus = 'pending'
            }
          }
        } catch (error) {
          console.error(`Error fetching reviews for PR #${pr.number}:`, error)
        }
      }
      
      return {
        id: pr.id.toString(),
        title: pr.title,
        number: pr.number,
        status: prStatus,
        branch: pr.head.ref,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        linkedTaskKey,
        repository: repoFullName,
        isDraft: pr.draft || false,
        reviewStatus,
        requestedReviewers,
        approvedReviewers,
      }
    }))
    
    // Log summary of linked PRs
    const linkedPRs = prs.filter((pr: GitHubPR) => pr.linkedTaskKey)
    if (linkedPRs.length > 0) {
      console.log(`Found ${linkedPRs.length} PRs linked to JIRA tasks in ${repoFullName}`)
    }
    
    return prs
  } catch (error) {
    console.error(`Error fetching PRs from ${repoFullName}:`, error)
    return []
  }
}

async function refreshActiveReposCache(): Promise<void> {
  try {
    console.log('Using whitelisted repositories for PR scanning...')
    
    // Whitelisted repositories that are known to have linked PRs
    const whitelistedRepos = [
      'tfso/apiworker-voucher',
      'tfso/website-accounting', 
      'tfso/react-layout-components'
    ]
    
    console.log(`Scanning ${whitelistedRepos.length} whitelisted repositories:`, whitelistedRepos)
    
    // Set the active repos to the whitelisted ones
    cachedActiveRepos = whitelistedRepos
    cachedActiveReposTimestamp = Date.now()
    
    console.log(`Active repositories cache updated: ${cachedActiveRepos.length} repositories`)
  } catch (error) {
    console.error('Error refreshing active repos cache:', error)
  }
}

// Function to manually add repositories to the active list
export function addRepositoryToActiveList(repoFullName: string): void {
  if (!cachedActiveRepos.includes(repoFullName)) {
    cachedActiveRepos.push(repoFullName)
    console.log(`Added ${repoFullName} to active repositories list`)
  }
}

// Function to clear the active repos cache (useful for testing)
export function clearActiveReposCache(): void {
  cachedActiveRepos = []
  cachedActiveReposTimestamp = 0
  console.log('Active repositories cache cleared')
}

function extractTaskKeyFromBranch(branchName: string): string | undefined {
  // Extract JIRA task key from branch name
  // Common patterns: feature/PROJ-123, bugfix/PROJ-456, etc.
  const patterns = [
    // Pattern 1: feature/PROJ-123_something -> PROJ-123
    /(?:feature|bugfix|hotfix|release)\/([A-Za-z]+-\d+)(?:_|$)/i,
    // Pattern 2: Just the task key anywhere in the branch name
    /([A-Za-z]+-\d+)(?:_|$)/i,
    // Pattern 3: Specific project patterns with numbers only
    /(?:ROC|PROJ|JIRA)-(\d+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = branchName.match(pattern)
    if (match) {
      const taskKey = match[1]
      // If it's just a number, prefix with ROC (based on your JIRA project)
      if (/^\d+$/.test(taskKey)) {
        const result = `ROC-${taskKey}`
        console.log(`Extracted task key from branch "${branchName}": ${result}`)
        return result
      }
      console.log(`Extracted task key from branch "${branchName}": ${taskKey}`)
      return taskKey.toUpperCase()
    }
  }
  
  console.log(`No task key found in branch: "${branchName}"`)
  return undefined
}

export async function fetchPullRequestsForTask(taskKey: string, repoFullName?: string): Promise<GitHubPR[]> {
  const allPRs = await fetchPullRequests(repoFullName)
  return allPRs.filter(pr => pr.linkedTaskKey === taskKey)
}

// Helper function to check rate limits
export async function checkGitHubRateLimit(): Promise<{
  remaining: number
  limit: number
  resetTime: Date | null
  isRateLimited: boolean
}> {
    if (!GITHUB_TOKEN) {
    console.warn('⚠️  No GitHub token configured')
    return { remaining: 0, limit: 0, resetTime: null, isRateLimited: true }
  }

  try {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

          if (response.ok) {
        const data = await response.json()
        const core = data.resources.core
        const resetTime = new Date(core.reset * 1000)
        const isRateLimited = core.remaining === 0

        // Additional debugging for rate limit issues
        if (core.remaining < 10) {
          console.warn(`⚠️  GitHub API rate limit is very low: ${core.remaining}/${core.limit} remaining`)
        }

        return {
          remaining: core.remaining,
          limit: core.limit,
          resetTime,
          isRateLimited
        }
      }
    
    console.error('Failed to check rate limit:', response.status, response.statusText)
    return { remaining: 0, limit: 0, resetTime: null, isRateLimited: true }
  } catch (error) {
    console.error('Error checking rate limit:', error)
    return { remaining: 0, limit: 0, resetTime: null, isRateLimited: true }
  }
}

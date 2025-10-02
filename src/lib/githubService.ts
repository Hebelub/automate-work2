import { GitHubPR, ReviewGitHubPR } from "@/types"

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
      let requiredReviewers: number = 0
      let hasApprovals = false
      let hasChangesRequested = false
      
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
              // Get the latest review from each reviewer (reviews are returned in chronological order)
              const latestReviews = new Map()
              reviews.forEach((review: any) => {
                // Only consider non-comment reviews for status determination
                if (review.state !== 'COMMENTED') {
                  latestReviews.set(review.user.login, review.state)
                }
              })
              
              hasApprovals = Array.from(latestReviews.values()).some((state: string) => state === 'APPROVED')
              hasChangesRequested = Array.from(latestReviews.values()).some((state: string) => state === 'CHANGES_REQUESTED')
              
              // Get approved reviewers first
              approvedReviewers = Array.from(latestReviews.entries())
                .filter(([_, state]) => state === 'APPROVED')
                .map(([reviewer, _]) => reviewer)
            } else if (requestedReviewers.length > 0) {
              reviewStatus = 'pending'
            }
          }

          // Simple logic: react-layout-components requires 2 reviews, others require 1
          if (repoFullName === 'tfso/react-layout-components') {
            requiredReviewers = 2
          } else {
            requiredReviewers = 1
          }
          console.log(`Required reviewers for ${repoFullName}: ${requiredReviewers}`)
            
          // Now determine the correct review status based on all information
          if (hasChangesRequested) {
            reviewStatus = 'changes_requested'
          } else if (hasApprovals) {
            // Check if we have enough approvals based on required reviewers count
            if (requiredReviewers > 0 && approvedReviewers.length >= requiredReviewers) {
              reviewStatus = 'approved'
            } else if (requiredReviewers > 0) {
              reviewStatus = 'pending'
            } else {
              // If no required reviewers count, any approval means approved
              reviewStatus = 'approved'
            }
          } else {
            reviewStatus = 'pending'
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
        requiredReviewers,
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

// Fetch detailed PR information including reviews
async function fetchPRDetails(owner: string, repo: string, prNumber: number): Promise<any> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.error(`Failed to fetch PR details for ${owner}/${repo}#${prNumber}: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error(`Error fetching PR details for ${owner}/${repo}#${prNumber}:`, error)
    return null
  }
}

// Fetch PR reviews
async function fetchPRReviews(owner: string, repo: string, prNumber: number): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.error(`Failed to fetch PR reviews for ${owner}/${repo}#${prNumber}: ${response.status}`)
      return []
    }

    return await response.json()
  } catch (error) {
    console.error(`Error fetching PR reviews for ${owner}/${repo}#${prNumber}:`, error)
    return []
  }
}

// Fetch PRs that need review using GitHub Search API
export async function fetchPRsNeedingReview(): Promise<ReviewGitHubPR[]> {
  if (!GITHUB_TOKEN) {
    console.warn('GitHub credentials not configured, returning empty array')
    return []
  }

  try {
    console.log('Fetching PRs needing review from GitHub...')
    
    // Use GitHub Search API to find PRs that need review
    // This searches across ALL repositories the user has access to
    const searchQuery = 'is:pr is:open review-requested:@me'
    const response = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&sort=updated&order=desc&per_page=100`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`GitHub Search API error: ${response.status} ${response.statusText}`)
      console.error('Error details:', errorText)
      throw new Error(`GitHub Search API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`Found ${data.items.length} PRs needing review`)

    // Transform search results to ReviewGitHubPR format and fetch detailed info
    const prs: ReviewGitHubPR[] = await Promise.all(
      data.items.map(async (item: any) => {
        // Extract repository name from the URL
        const repoUrl = item.repository_url
        const repoMatch = repoUrl.match(/\/repos\/([^\/]+)\/([^\/]+)$/)
        const repository = repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : 'unknown'
        const [owner, repo] = repository.split('/')

        // Fetch detailed PR information
        const prDetails = await fetchPRDetails(owner, repo, item.number)
        const reviews = await fetchPRReviews(owner, repo, item.number)

        // Calculate approval status
        const approvedReviews = reviews.filter((review: any) => review.state === 'APPROVED')
        const changesRequestedReviews = reviews.filter((review: any) => review.state === 'CHANGES_REQUESTED')
        const pendingReviews = reviews.filter((review: any) => review.state === 'PENDING')
        
        // Determine review status
        let reviewStatus = 'pending_review'
        if (approvedReviews.length > 0) {
          reviewStatus = 'approved'
        } else if (changesRequestedReviews.length > 0) {
          reviewStatus = 'changes_requested'
        } else if (pendingReviews.length > 0) {
          reviewStatus = 'pending_review'
        }

        return {
          id: item.id.toString(),
          number: item.number,
          title: item.title,
          body: item.body || '',
          state: item.state,
          draft: item.draft || false,
          url: item.html_url,
          repository,
          branch: item.head?.ref || '',
          baseBranch: item.base?.ref || '',
          author: item.user?.login || 'unknown',
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          mergedAt: item.pull_request?.merged_at || null,
          closedAt: item.closed_at,
          commits: prDetails?.commits || 0,
          additions: prDetails?.additions || 0,
          deletions: prDetails?.deletions || 0,
          changedFiles: prDetails?.changed_files || 0,
          reviewStatus,
          localGitStatus: null, // Will be fetched separately if needed
          // Additional review information
          approvedReviews: approvedReviews.length,
          changesRequestedReviews: changesRequestedReviews.length,
          pendingReviews: pendingReviews.length,
          totalReviews: reviews.length,
          reviewers: reviews.map((review: any) => review.user?.login).filter(Boolean)
        }
      })
    )

    return prs
  } catch (error) {
    console.error('Error fetching PRs needing review:', error)
    return []
  }
}
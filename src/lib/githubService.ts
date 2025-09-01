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
      console.error(`GitHub API error: ${response.status} ${response.statusText}`, errorText)
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

export async function fetchPullRequests(repoFullName?: string): Promise<GitHubPR[]> {
  if (!GITHUB_TOKEN) {
    console.warn('GitHub credentials not configured, returning empty array')
    return []
  }

  try {
    if (repoFullName) {
      // Fetch from specific repository
      console.log(`Fetching PRs from GitHub repo: ${repoFullName}`)
      
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
        const errorText = await response.text()
        console.error(`GitHub API error: ${response.status} ${response.statusText}`, errorText)
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`Fetched ${data.length} PRs from GitHub repo: ${repoFullName}`)
      
      const prs = data.map((pr: any) => {
        const linkedTaskKey = extractTaskKeyFromBranch(pr.head.ref)
        console.log(`PR #${pr.number}: branch "${pr.head.ref}" -> task "${linkedTaskKey}"`)
        
        return {
          id: pr.id.toString(),
          title: pr.title,
          number: pr.number,
          status: pr.merged_at ? 'merged' : pr.state,
          branch: pr.head.ref,
          url: pr.html_url,
          author: pr.user.login,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          linkedTaskKey,
          repository: repoFullName,
        }
      })
      
      // Log summary of linked PRs
      const linkedPRs = prs.filter((pr: GitHubPR) => pr.linkedTaskKey)
      console.log(`Found ${linkedPRs.length} PRs linked to JIRA tasks in ${repoFullName}`)
      
      return prs
    } else {
      // Fetch from all repositories - optimized to avoid recursive calls
      console.log('Fetching PRs from all repositories...')
      const repos = await fetchUserRepositories()
      const allPRs: GitHubPR[] = []
      
      // Fetch PRs from all repositories in parallel
      const prPromises = repos.map(async (repo) => {
        try {
          const response = await fetch(
            `https://api.github.com/repos/${repo.full_name}/pulls?state=all&per_page=100&sort=updated&direction=desc`,
            {
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          )

          if (!response.ok) {
            console.error(`Failed to fetch PRs from ${repo.full_name}: ${response.status}`)
            return []
          }

          const data = await response.json()
          console.log(`Fetched ${data.length} PRs from ${repo.full_name}`)
          
          return data.map((pr: any) => {
            const linkedTaskKey = extractTaskKeyFromBranch(pr.head.ref)
            return {
              id: pr.id.toString(),
              title: pr.title,
              number: pr.number,
              status: pr.merged_at ? 'merged' : pr.state,
              branch: pr.head.ref,
              url: pr.html_url,
              author: pr.user.login,
              createdAt: pr.created_at,
              updatedAt: pr.updated_at,
              linkedTaskKey,
              repository: repo.full_name,
            }
          })
        } catch (error: any) {
          console.error(`Error fetching PRs from ${repo.full_name}:`, error)
          return []
        }
      })
      
      // Wait for all PR fetches to complete
      const results = await Promise.all(prPromises)
      results.forEach(prs => allPRs.push(...prs))
      
      console.log(`Total PRs fetched from all repositories: ${allPRs.length}`)
      const linkedPRs = allPRs.filter(pr => pr.linkedTaskKey)
      console.log(`Total PRs linked to JIRA tasks: ${linkedPRs.length}`)
      
      return allPRs
    }
  } catch (error) {
    console.error('Error fetching GitHub PRs:', error)
    return []
  }
}

function extractTaskKeyFromBranch(branchName: string): string | undefined {
  // Extract JIRA task key from branch name
  // Common patterns: feature/PROJ-123, bugfix/PROJ-456, etc.
  const patterns = [
    /(?:feature|bugfix|hotfix|release)\/([A-Z]+-\d+)/i,
    /([A-Z]+-\d+)/, // Just the task key
    /(?:ROC|PROJ|JIRA)-(\d+)/i, // Specific project patterns
  ]
  
  for (const pattern of patterns) {
    const match = branchName.match(pattern)
    if (match) {
      const taskKey = match[1]
      // If it's just a number, prefix with ROC (based on your JIRA project)
      if (/^\d+$/.test(taskKey)) {
        return `ROC-${taskKey}`
      }
      return taskKey
    }
  }
  
  return undefined
}

export async function fetchPullRequestsForTask(taskKey: string, repoFullName?: string): Promise<GitHubPR[]> {
  const allPRs = await fetchPullRequests(repoFullName)
  return allPRs.filter(pr => pr.linkedTaskKey === taskKey)
}

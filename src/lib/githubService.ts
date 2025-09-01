import { GitHubPR } from "@/types"

// For now, we'll need to add GitHub token to .env.local
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO // format: "owner/repo"

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.warn('GitHub environment variables are not configured')
}

export async function fetchPullRequests(): Promise<GitHubPR[]> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.warn('GitHub credentials not configured, returning empty array')
    return []
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/pulls?state=all&per_page=100`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    return data.map((pr: any) => ({
      id: pr.id.toString(),
      title: pr.title,
      number: pr.number,
      status: pr.merged_at ? 'merged' : pr.state,
      branch: pr.head.ref,
      url: pr.html_url,
      author: pr.user.login,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      linkedTaskKey: extractTaskKeyFromBranch(pr.head.ref),
    }))
  } catch (error) {
    console.error('Error fetching GitHub PRs:', error)
    return []
  }
}

function extractTaskKeyFromBranch(branchName: string): string | undefined {
  // Extract JIRA task key from branch name
  // Common patterns: feature/PROJ-123, bugfix/PROJ-456, etc.
  const match = branchName.match(/(?:feature|bugfix|hotfix|release)\/([A-Z]+-\d+)/i)
  return match ? match[1] : undefined
}

export async function fetchPullRequestsForTask(taskKey: string): Promise<GitHubPR[]> {
  const allPRs = await fetchPullRequests()
  return allPRs.filter(pr => pr.linkedTaskKey === taskKey)
}

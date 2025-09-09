import { LocalBranch } from "@/types"
import { Badge } from "@/components/ui/badge"
import { GitBranch, Upload, AlertCircle, CheckCircle, Clock, Trash2, GitPullRequest } from "lucide-react"
import { useState } from "react"
import { RepositoryBranchInfo } from "@/components/RepositoryBranchInfo"
import { clearPRGitStatus } from "@/lib/jiraMetadataService"

interface LocalBranchesProps {
  branches: LocalBranch[]
  taskKey: string
  hideRepositoryNames?: boolean // Hide repository badges when used in PR context
  hideBranchNames?: boolean // Hide branch names when used in PR context
  prStatus?: 'open' | 'closed' | 'merged' | 'draft' // PR status to determine if delete button should be shown
  prId?: string // PR ID to clear git status when branch is deleted
  taskStatus?: string // JIRA task status
}

export function LocalBranches({ branches, taskKey, hideRepositoryNames = false, hideBranchNames = false, prStatus, prId, taskStatus }: LocalBranchesProps) {
  const [pushingBranches, setPushingBranches] = useState<Set<string>>(new Set())
  const [deletingBranches, setDeletingBranches] = useState<Set<string>>(new Set())

  // Helper function to get the display repository name
  const getDisplayRepoName = (branch: LocalBranch): string => {
    if (branch.remoteOrigin) {
      // Extract owner/repo from remote origin URL (e.g., "https://github.com/tfso/website-accounting.git")
      const remoteMatch = branch.remoteOrigin.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
      if (remoteMatch) {
        const [, owner, repo] = remoteMatch
        return `${owner}/${repo}`
      }
    }
    // Fallback to local repository name
    return branch.repository
  }

  const [pushErrors, setPushErrors] = useState<Record<string, string>>({})

  // Helper function to create GitHub compare URL for creating a PR
  const createPRUrl = (branch: LocalBranch): string | null => {
    if (!branch.remoteOrigin) return null
    
    // Extract owner/repo from remote origin URL (e.g., "https://github.com/tfso/website-accounting.git")
    const remoteMatch = branch.remoteOrigin.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (!remoteMatch) return null
    
    const [, owner, repo] = remoteMatch
    return `https://github.com/${owner}/${repo}/compare/${encodeURIComponent(branch.branch)}?expand=1`
  }

  // Handle "Create PR" button click
  const handleCreatePR = (branch: LocalBranch) => {
    const url = createPRUrl(branch)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const pushBranch = async (branch: LocalBranch) => {
    setPushingBranches(prev => new Set(prev).add(branch.branch))
    setPushErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[branch.branch]
      return newErrors
    })

    try {
      const response = await fetch('/api/local-git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push',
          repoName: branch.repository,
          branchName: branch.branch
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      // Refresh the page to update branch status
      window.location.reload()
    } catch (error) {
      console.error('Error pushing branch:', error)
      setPushErrors(prev => ({
        ...prev,
        [branch.branch]: error instanceof Error ? error.message : 'Failed to push branch'
      }))
    } finally {
      setPushingBranches(prev => {
        const newSet = new Set(prev)
        newSet.delete(branch.branch)
        return newSet
      })
    }
  }

  const deleteBranch = async (branch: LocalBranch) => {
    setDeletingBranches(prev => new Set(prev).add(branch.branch))

    try {
      const response = await fetch('/api/local-git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          repoName: branch.repository,
          branchName: branch.branch
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      // Clear the cached git status for this PR if we have the PR ID
      if (prId) {
        clearPRGitStatus(prId)
      }

      // Show success message for already deleted branches
      if (result.message === 'Branch was already deleted') {
        // Just refresh without showing error
        window.location.reload()
        return
      }

      // Refresh the page to update branch list
      window.location.reload()
    } catch (error) {
      console.error('Error deleting branch:', error)
      alert(`Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDeletingBranches(prev => {
        const newSet = new Set(prev)
        newSet.delete(branch.branch)
        return newSet
      })
    }
  }

  if (branches.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {branches.map((branch) => (
          <div key={`${getDisplayRepoName(branch)}-${branch.branch}`} className="bg-gray-50 p-3 rounded border">
            <div className="space-y-2">
              {/* Only show RepositoryBranchInfo if it will display something */}
              {(!hideRepositoryNames || !hideBranchNames) && (
                <RepositoryBranchInfo 
                  repository={getDisplayRepoName(branch)}
                  branch={branch.branch}
                  hideRepository={hideRepositoryNames}
                  hideBranch={hideBranchNames}
                />
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Git Status */}
                  {!branch.hasRemote ? (
                    <Badge className="bg-orange-100 text-orange-600 border-orange-200">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Not on GitHub
                    </Badge>
                  ) : branch.isAhead ? (
                    <Badge className="bg-blue-100 text-blue-600 border-blue-200">
                      <Clock className="h-3 w-3 mr-1" />
                      {branch.aheadCount} ahead
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-600 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Up to date
                    </Badge>
                  )}
                  
                  <span className="text-xs text-gray-500">
                    {!branch.hasRemote ? 'Local branch not pushed to GitHub' : 
                     branch.isAhead ? `${branch.aheadCount} commits ahead of remote` : 
                     'Branch is up to date with remote'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Show delete button for closed/merged PRs */}
                  {prStatus && (prStatus === 'closed' || prStatus === 'merged') && (
                    <button
                      onClick={() => deleteBranch(branch)}
                      disabled={deletingBranches.has(branch.branch)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 border border-red-200 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                      title="Delete local branch"
                    >
                      <Trash2 className={`h-3 w-3 ${deletingBranches.has(branch.branch) ? 'animate-spin' : ''}`} />
                      {deletingBranches.has(branch.branch) ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                  
                  {/* Show "Create PR" button for branches that are pushed and up to date, but only if no PR exists */}
                  {branch.hasRemote && !branch.isAhead && !prStatus && (
                    <button
                      onClick={() => handleCreatePR(branch)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 border border-green-200 rounded hover:bg-green-200 transition-colors"
                      title="Create Pull Request on GitHub"
                    >
                      <GitPullRequest className="h-3 w-3" />
                      Create PR
                    </button>
                  )}
                  
                  {/* Show push button for branches that need to be pushed */}
                  {(!branch.hasRemote || branch.isAhead) && (!prStatus || prStatus === 'open' || prStatus === 'draft') && (
                    <button
                      onClick={() => pushBranch(branch)}
                      disabled={pushingBranches.has(branch.branch)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                      title="Push branch to GitHub"
                    >
                      <Upload className={`h-3 w-3 ${pushingBranches.has(branch.branch) ? 'animate-spin' : ''}`} />
                      {pushingBranches.has(branch.branch) ? 'Pushing...' : 'Push'}
                    </button>
                  )}
                </div>
              </div>

              {pushErrors[branch.branch] && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {pushErrors[branch.branch]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

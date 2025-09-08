import { GitBranch, GitPullRequest, Copy, Check } from "lucide-react"
import { useState } from "react"

interface RepositoryBranchInfoProps {
  repository?: string
  branch?: string
  hideRepository?: boolean
  hideBranch?: boolean
}

export function RepositoryBranchInfo({ 
  repository, 
  branch, 
  hideRepository = false, 
  hideBranch = false 
}: RepositoryBranchInfoProps) {
  const [copiedRepo, setCopiedRepo] = useState(false)
  const [copiedBranch, setCopiedBranch] = useState(false)

  const handleCopyRepo = async () => {
    if (!repository) return
    await navigator.clipboard.writeText(repository)
    setCopiedRepo(true)
    setTimeout(() => setCopiedRepo(false), 2000)
  }

  const handleCopyBranch = async () => {
    if (!branch) return
    await navigator.clipboard.writeText(branch)
    setCopiedBranch(true)
    setTimeout(() => setCopiedBranch(false), 2000)
  }

  return (
    <div className="space-y-2">
      {/* Repository */}
      {repository && !hideRepository && (
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-3 w-3 text-gray-500" />
          <span className="text-xs text-gray-600 font-mono">{repository}</span>
          <button
            onClick={handleCopyRepo}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Copy repository name"
          >
            {copiedRepo ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      )}
      
      {/* Branch */}
      {branch && !hideBranch && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <GitBranch className="h-3 w-3" />
          <span className="font-mono">{branch}</span>
          <button
            onClick={handleCopyBranch}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Copy branch name"
          >
            {copiedBranch ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      )}
    </div>
  )
}

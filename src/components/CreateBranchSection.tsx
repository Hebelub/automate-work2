import { useState } from "react"
import { Copy, Check, GitBranch } from "lucide-react"
import { generateGitCheckoutCommand } from "@/lib/utils"

interface CreateBranchSectionProps {
  taskKey: string
  taskName: string
  issueType: string
}

export function CreateBranchSection({ taskKey, taskName, issueType }: CreateBranchSectionProps) {
  const [copiedGitCommand, setCopiedGitCommand] = useState(false)

  const handleCopyGitCommand = () => {
    const gitCommand = generateGitCheckoutCommand(taskKey, taskName, issueType)
    navigator.clipboard.writeText(gitCommand).then(() => {
      setCopiedGitCommand(true)
      setTimeout(() => setCopiedGitCommand(false), 2000)
    }).catch(() => {
      // Handle error if copying fails
    })
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <GitBranch className="h-3 w-3" />
      <span className="font-mono">{generateGitCheckoutCommand(taskKey, taskName, issueType)}</span>
      <button
        onClick={handleCopyGitCommand}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        title="Copy git command"
      >
        {copiedGitCommand ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  )
}

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
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <GitBranch className="h-4 w-4" />
        Create New Branch
      </div>
      
      <div className="bg-gray-50 rounded-lg p-3 border">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <code className="text-sm font-mono text-gray-700 break-all">
              {generateGitCheckoutCommand(taskKey, taskName, issueType)}
            </code>
          </div>
          <button
            onClick={handleCopyGitCommand}
            className="ml-3 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            title="Copy git command"
          >
            {copiedGitCommand ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

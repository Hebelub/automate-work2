import { GitHubPR } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, GitBranch, User, GitPullRequest, CheckCircle, Clock, AlertCircle, Users, Copy, Check } from "lucide-react"
import { useState } from "react"

interface PullRequestCardProps {
  pr: GitHubPR
}

export function PullRequestCard({ pr }: PullRequestCardProps) {
  const [copiedRepo, setCopiedRepo] = useState(false)
  const [copiedBranch, setCopiedBranch] = useState(false)

  const handleCopyRepo = async () => {
    await navigator.clipboard.writeText(pr.repository || '')
    setCopiedRepo(true)
    setTimeout(() => setCopiedRepo(false), 2000)
  }

  const handleCopyBranch = async () => {
    await navigator.clipboard.writeText(pr.branch)
    setCopiedBranch(true)
    setTimeout(() => setCopiedBranch(false), 2000)
  }

  const getStatusColor = (status: GitHubPR['status']) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'closed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'merged':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getReviewStatusColor = (status: GitHubPR['reviewStatus']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'changes_requested':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'no_reviews':
        return 'bg-gray-100 text-gray-600 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getReviewStatusText = (status: GitHubPR['reviewStatus']) => {
    switch (status) {
      case 'approved':
        return 'Approved'
      case 'pending':
        return 'Pending Review'
      case 'changes_requested':
        return 'Changes Requested'
      case 'no_reviews':
        return 'No Reviews'
      default:
        return 'Unknown'
    }
  }

  const getReviewStatusIcon = (status: GitHubPR['reviewStatus']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-3 w-3" />
      case 'pending':
        return <Clock className="h-3 w-3" />
      case 'changes_requested':
        return <AlertCircle className="h-3 w-3" />
      case 'no_reviews':
        return <Users className="h-3 w-3" />
      default:
        return <Users className="h-3 w-3" />
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium line-clamp-2">
            {pr.title}
          </CardTitle>
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Repository and Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-gray-600 font-mono">{pr.repository}</span>
              <button
                onClick={handleCopyRepo}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Copy repository name"
              >
                {copiedRepo ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <Badge className={getStatusColor(pr.status)}>
              #{pr.number} • {pr.status === 'open' && pr.isDraft ? 'Draft' : pr.status}
            </Badge>
          </div>
          
          {/* Branch */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <GitBranch className="h-3 w-3" />
            <span className="font-mono">{pr.branch}</span>
            <button
              onClick={handleCopyBranch}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy branch name"
            >
              {copiedBranch ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>

          {/* Review Status - Only show for open PRs */}
          {pr.status === 'open' && (
            <div className="flex items-center gap-2">
              <Badge className={getReviewStatusColor(pr.reviewStatus)}>
                <div className="flex items-center gap-1">
                  {getReviewStatusIcon(pr.reviewStatus)}
                  {getReviewStatusText(pr.reviewStatus)}
                </div>
              </Badge>
            </div>
          )}

          {/* Reviewers Information - Only show for open PRs */}
          {pr.status === 'open' && pr.requestedReviewers.length > 0 && (
            <div className="text-xs text-gray-600">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3" />
                <span className="font-medium">Waiting for:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {pr.requestedReviewers.map((reviewer, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {reviewer}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {pr.status !== 'merged' && pr.approvedReviewers.length > 0 && (
            <div className="text-xs text-gray-600">
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle className="h-3 w-3" />
                <span className="font-medium">Approved by:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {pr.approvedReviewers.map((reviewer, index) => (
                  <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    {reviewer}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

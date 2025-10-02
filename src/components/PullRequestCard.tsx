import { GitHubPR, LocalBranch } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, GitBranch, User, GitPullRequest, CheckCircle, Clock, AlertCircle, Users, Copy, Check, Eye, EyeOff, Link, FileText } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { DualCopyButton } from "@/components/ui/dual-copy-button"
import { useState } from "react"
import { PullRequestMetadata } from "@/lib/jiraMetadataService"
import { LocalBranches } from "@/components/LocalBranches"
import { RepositoryBranchInfo } from "@/components/RepositoryBranchInfo"

interface PullRequestCardProps {
  pr: GitHubPR & PullRequestMetadata
  onUpdateMetadata: (prId: string, updates: Partial<PullRequestMetadata>) => void
  taskStatus?: string // JIRA task status to display in local branches
}

export function PullRequestCard({ pr, onUpdateMetadata, taskStatus }: PullRequestCardProps) {
  // Local git status is now fetched in bulk by the parent component

  const handleToggleHidden = () => {
    onUpdateMetadata(pr.id, { hidden: !pr.hidden })
  }



  const getStatusColor = (status: GitHubPR['status'], reviewStatus?: GitHubPR['reviewStatus'], isDraft?: boolean) => {
    // Give draft PRs a distinctive color
    if (isDraft) {
      return 'bg-orange-100 text-orange-800 border-orange-200'
    }
    
    // If not draft, use review status color if available
    if (reviewStatus && reviewStatus !== 'no_reviews') {
      switch (reviewStatus) {
        case 'approved':
          return 'bg-green-100 text-green-800 border-green-200'
        case 'pending':
          return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        case 'changes_requested':
          return 'bg-red-100 text-red-800 border-red-200'
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200'
      }
    }
    
    // Fallback to original status
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'closed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'merged':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'draft':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getReviewStatusColor = (status: GitHubPR['reviewStatus'], pr: GitHubPR & PullRequestMetadata) => {
    // For draft PRs, show draft color
    if (pr.isDraft) {
      return 'bg-gray-100 text-gray-800 border-gray-200'
    }
    
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'pending':
        // Different colors based on whether reviews are required
        if (pr.requestedReviewers.length > 0) {
          return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        } else {
          return 'bg-blue-100 text-blue-800 border-blue-200'
        }
      case 'changes_requested':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'no_reviews':
        return 'bg-gray-100 text-gray-600 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getMainStatusText = (pr: GitHubPR & PullRequestMetadata) => {
    // Priority: draft ?? approverStatus ?? open
    if (pr.isDraft) {
      return 'Draft'
    }
    
    // If not draft, show review status if available
    if (pr.reviewStatus && pr.reviewStatus !== 'no_reviews') {
      return getReviewStatusText(pr.reviewStatus, pr)
    }
    
    // Fallback to original status
    switch (pr.status) {
      case 'open':
        return 'Open'
      case 'closed':
        return 'Closed'
      case 'merged':
        return 'Merged'
      case 'draft':
        return 'Draft'
      default:
        return 'Unknown'
    }
  }

  const getReviewStatusText = (status: GitHubPR['reviewStatus'], pr: GitHubPR & PullRequestMetadata) => {
    // For draft PRs, show draft status instead of review status
    if (pr.isDraft) {
      return 'Draft'
    }
    
    switch (status) {
      case 'approved':
        return 'Approved'
      case 'pending':
        // If there are requested reviewers but no approvals yet, show "Needs n more reviews"
        // If there are no requested reviewers, show "No Reviews Required"
        if (pr.requestedReviewers.length > 0) {
          const neededReviews = (pr.requiredReviewers || 1) - pr.approvedReviewers.length
          return `Needs ${neededReviews} more review${neededReviews !== 1 ? 's' : ''}`
        } else {
          return 'No Reviews Required'
        }
      case 'changes_requested':
        return 'Changes Requested'
      case 'no_reviews':
        return 'No Reviews'
      default:
        return 'Unknown'
    }
  }

  const getReviewStatusIcon = (status: GitHubPR['reviewStatus'], pr: GitHubPR & PullRequestMetadata) => {
    // For draft PRs, show draft icon
    if (pr.isDraft) {
      return <FileText className="h-3 w-3" />
    }
    
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-3 w-3" />
      case 'pending':
        // Show different icons based on whether reviews are required
        if (pr.requestedReviewers.length > 0) {
          return <Clock className="h-3 w-3" />
        } else {
          return <CheckCircle className="h-3 w-3" />
        }
      case 'changes_requested':
        return <AlertCircle className="h-3 w-3" />
      case 'no_reviews':
        return <Users className="h-3 w-3" />
      default:
        return <Users className="h-3 w-3" />
    }
  }

  // If PR is hidden, show compact version
  if (pr.hidden) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border text-sm">
        <button
          onClick={handleToggleHidden}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          title="Show PR details"
        >
          <Eye className="h-4 w-4" />
        </button>
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-gray-500 hover:text-blue-600 hover:underline transition-colors"
          title="Open PR in GitHub"
        >
          #{pr.number}
        </a>
        <DualCopyButton
          identifier={`#${pr.number}`}
          url={pr.url}
          identifierTooltip="Copy PR number"
          urlTooltip="Copy PR URL"
        />
        <Badge variant="outline" className={`text-xs ${getStatusColor(pr.status, pr.reviewStatus, pr.isDraft)}`}>
          {getMainStatusText(pr)}
        </Badge>
        <GitPullRequest className="h-3 w-3 text-gray-500" />
        <span className="font-mono text-gray-600">{pr.repository}</span>
        <span className="text-gray-800 truncate">{pr.branch}</span>
      </div>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-gray-500 hover:text-blue-600 hover:underline transition-colors"
                title="Open PR in GitHub"
              >
                #{pr.number}
              </a>
              <DualCopyButton
                identifier={`#${pr.number}`}
                url={pr.url}
                identifierTooltip="Copy PR number"
                urlTooltip="Copy PR URL"
              />
              <Badge className={getStatusColor(pr.status, pr.reviewStatus, pr.isDraft)}>
                {getMainStatusText(pr)}
              </Badge>
            </div>
            <CardTitle className="text-sm font-medium line-clamp-2">
              {pr.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleHidden}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Hide PR details"
            >
              <EyeOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Repository and Branch */}
          <div className="flex items-center justify-between">
            <RepositoryBranchInfo 
              repository={pr.repository}
              branch={pr.branch}
            />
          </div>

          {/* Local Git Status - Only show if branch exists locally */}
          {pr.localGitStatus && pr.localGitStatus.exists && (
            <LocalBranches 
              branches={[{
                branch: pr.localGitStatus.branch,
                repository: pr.localGitStatus.repository || pr.repository || 'unknown',
                lastCommit: pr.localGitStatus.lastCommit,
                hasRemote: true, // PR exists, so branch is on GitHub
                isAhead: pr.localGitStatus.ahead > 0,
                aheadCount: pr.localGitStatus.ahead,
                remoteOrigin: `https://github.com/${pr.repository}.git` // Construct remote origin from PR repository
              }]} 
              taskKey={pr.linkedTaskKey || ''} 
              hideRepositoryNames={true}
              hideBranchNames={true}
              prStatus={pr.status}
              prId={pr.id}
              taskStatus={taskStatus}
            />
          )}

          {/* Reviewers Information - Only show for open, non-draft PRs */}
          {pr.status === 'open' && !pr.isDraft && (
            <div className="flex items-center gap-4 text-xs text-gray-600">
                {/* Waiting for section */}
                {pr.requestedReviewers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
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

                {/* Rejected by section - only show if changes requested */}
                {pr.reviewStatus === 'changes_requested' && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-red-600" />
                      <span className="font-medium">Changes requested:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {/* For now, show all requested reviewers as they requested changes */}
                      {pr.requestedReviewers.map((reviewer, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                          {reviewer}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approved by section */}
                {pr.approvedReviewers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
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
          )}
        </div>
      </CardContent>
    </Card>
  )
}

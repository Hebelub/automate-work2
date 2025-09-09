import { useState, useEffect } from 'react'
import { ReviewGitHubPR } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, GitPullRequest, Clock, User, CheckCircle, AlertCircle, Circle } from 'lucide-react'

interface ReviewInboxProps {
  prs: ReviewGitHubPR[]
  isLoading: boolean
  hasNewPRs?: boolean
  lastUpdateTime?: Date | null
}

export function ReviewInbox({ 
  prs, 
  isLoading, 
  hasNewPRs = false, 
  lastUpdateTime
}: ReviewInboxProps) {
  const [expanded, setExpanded] = useState(true)

  // Auto-expand when there are new PRs
  useEffect(() => {
    if (hasNewPRs) {
      setExpanded(true)
    }
  }, [hasNewPRs])


  // Function to get approval status badge
  const getApprovalStatus = (pr: ReviewGitHubPR) => {
    const approvedCount = pr.approvedReviews || 0
    const changesRequestedCount = pr.changesRequestedReviews || 0
    const pendingCount = pr.pendingReviews || 0
    const totalReviews = pr.totalReviews || 0

    if (approvedCount > 0) {
      return {
        icon: <CheckCircle className="h-3 w-3" />,
        text: `${approvedCount} approved`,
        variant: 'default' as const,
        className: 'bg-green-100 text-green-800 border-green-200'
      }
    } else if (changesRequestedCount > 0) {
      return {
        icon: <AlertCircle className="h-3 w-3" />,
        text: `${changesRequestedCount} changes requested`,
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800 border-red-200'
      }
    } else if (pendingCount > 0) {
      return {
        icon: <Circle className="h-3 w-3" />,
        text: `${pendingCount} pending`,
        variant: 'secondary' as const,
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      }
    } else {
      return {
        icon: <Circle className="h-3 w-3" />,
        text: 'No reviews',
        variant: 'outline' as const,
        className: 'bg-gray-100 text-gray-600 border-gray-200'
      }
    }
  }

  // Don't show loading state - load silently in background
  if (isLoading && prs.length === 0) {
    return null
  }

  if (prs.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitPullRequest className="h-5 w-5 text-green-600" />
            Review Inbox
            <Badge variant="secondary" className="ml-2">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <p className="text-sm text-gray-600">🎉 No PRs need your review right now!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader className={`pb-3 ${!expanded ? 'pb-6' : ''}`}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GitPullRequest className="h-5 w-5 text-orange-600" />
          Review Inbox
           <Badge variant="destructive" className="ml-2">{prs.length}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="ml-auto"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </CardTitle>
        {lastUpdateTime && (
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {lastUpdateTime.toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-3 pb-6">
          {prs.map((pr) => {
            const approvalStatus = getApprovalStatus(pr)
            return (
              <div
                key={pr.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm truncate">{pr.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      #{pr.number}
                    </Badge>
                    {pr.isDraft && (
                      <Badge variant="secondary" className="text-xs">
                        Draft
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-xs flex items-center gap-1 ${approvalStatus.className}`}>
                      {approvalStatus.icon}
                      {approvalStatus.text}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{pr.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(pr.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <span className="font-mono text-xs">{pr.repository}</span>
                    {pr.reviewers && pr.reviewers.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Reviewers:</span>
                        <span className="font-mono">{pr.reviewers.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(pr.url, '_blank')}
                  className="ml-2"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Review
                </Button>
              </div>
            )
          })}
        </CardContent>
      )}
    </Card>
  )
}

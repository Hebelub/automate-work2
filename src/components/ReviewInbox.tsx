import { useState, useEffect } from 'react'
import { ReviewGitHubPR } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, GitPullRequest, Clock, User, CheckCircle, AlertCircle, Circle } from 'lucide-react'

// Helper functions for read tracking
const getReadPRs = (): Set<string> => {
  try {
    const read = localStorage.getItem('review-inbox-read')
    return new Set(JSON.parse(read || '[]'))
  } catch {
    return new Set()
  }
}

const markPRAsRead = (prId: string) => {
  try {
    const read = getReadPRs()
    read.add(prId)
    localStorage.setItem('review-inbox-read', JSON.stringify([...read]))
  } catch (error) {
    console.error('Failed to mark PR as read:', error)
  }
}

const markAllAsRead = (prs: ReviewGitHubPR[]) => {
  try {
    const read = getReadPRs()
    prs.forEach(pr => read.add(pr.id))
    localStorage.setItem('review-inbox-read', JSON.stringify([...read]))
  } catch (error) {
    console.error('Failed to mark all PRs as read:', error)
  }
}

// Function to format time since creation
const formatTimeSince = (createdAt: string): string => {
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()
  
  const minutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (minutes < 60) {
    return `${minutes}m`
  } else if (hours < 24) {
    return `${hours}h`
  } else {
    return `${days}d`
  }
}

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
  const [expanded, setExpanded] = useState(false)
  const [readPRs, setReadPRs] = useState<Set<string>>(new Set())

  // Load read PRs from localStorage
  useEffect(() => {
    setReadPRs(getReadPRs())
  }, [])

  // Calculate new vs total counts
  const newPRs = prs.filter(pr => !readPRs.has(pr.id))
  const newCount = newPRs.length
  const totalCount = prs.length

  // Handle expand/collapse
  const handleToggle = () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)
    
    // Mark all as read when opening
    if (newExpanded) {
      markAllAsRead(prs)
      setReadPRs(new Set(prs.map(pr => pr.id)))
    }
  }


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
          <div className="flex items-center gap-2 ml-2">
            {newCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {newCount} new
              </Badge>
            )}
            <Badge variant="outline" className="text-xs text-gray-500">
              {totalCount} total
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
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
            const isUnread = !readPRs.has(pr.id)
            return (
              <div
                key={pr.id}
                className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                  isUnread ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isUnread && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
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
                      <span>{formatTimeSince(pr.createdAt)} ago</span>
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

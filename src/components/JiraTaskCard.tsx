import { TaskWithPRs } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PullRequestCard } from "@/components/PullRequestCard"
import { ExternalLink, Clock, User, AlertTriangle, Copy, Check } from "lucide-react"
import { useState } from "react"

interface JiraTaskCardProps {
  task: TaskWithPRs
}

export function JiraTaskCard({ task }: JiraTaskCardProps) {
  const [copiedTaskKey, setCopiedTaskKey] = useState(false)

  const handleCopyTaskKey = () => {
    navigator.clipboard.writeText(task.key).then(() => {
      setCopiedTaskKey(true)
      setTimeout(() => setCopiedTaskKey(false), 2000)
    }).catch(() => {
      // Handle error if copying fails
    })
  }

  const getStatusColor = (status: TaskWithPRs['status']) => {
    switch (status) {
      case 'Open':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'On Hold':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'QA':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Ready for PROD':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityColor = (priority: TaskWithPRs['priority']) => {
    switch (priority) {
      case 'Low':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'Medium':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getIssueTypeColor = (issueType: string) => {
    switch (issueType.toLowerCase()) {
      case 'bug':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'story':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'task':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'sub-task':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'epic':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    }
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-mono text-gray-600">{task.key}</span>
              <button
                onClick={handleCopyTaskKey}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Copy task key"
              >
                {copiedTaskKey ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              </button>
              
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
              <Badge className={getIssueTypeColor(task.issueType)}>
                {task.issueType}
              </Badge>
              {task.priority !== 'Medium' && task.priority !== 'Normal' && (
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
              )}
              {!task.isInSprint && (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Not in Sprint
                </Badge>
              )}
            </div>
            
            <CardTitle className="text-lg font-semibold mb-3">
              {task.name}
            </CardTitle>
          </div>
          
          <a
            href={task.url}
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
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900">Pull Requests</h4>
            {task.pullRequests.length === 0 && (
              <Badge variant="outline" className="text-xs">
                No PRs
              </Badge>
            )}
          </div>
          
          {task.pullRequests.length > 0 && (
            <div className="space-y-2">
              {task.pullRequests.map((pr) => (
                <PullRequestCard key={pr.id} pr={pr} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

import { TaskWithPRs } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PullRequestCard } from "@/components/PullRequestCard"
import { ExternalLink, Clock, User, AlertTriangle } from "lucide-react"

interface JiraTaskCardProps {
  task: TaskWithPRs
}

export function JiraTaskCard({ task }: JiraTaskCardProps) {
  const getStatusColor = (status: TaskWithPRs['status']) => {
    switch (status) {
      case 'To Do':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'QA':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Done':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Blocked':
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

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg font-semibold">
                {task.key}: {task.name}
              </CardTitle>
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
              {task.isInSprint && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Sprint
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>{task.assignee}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {task.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {task.description}
          </p>
        )}
        
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900">Pull Requests</h4>
            {task.pullRequests.length === 0 && (
              <Badge variant="outline" className="text-xs">
                No PRs
              </Badge>
            )}
          </div>
          
          {task.pullRequests.length > 0 ? (
            <div className="space-y-2">
              {task.pullRequests.map((pr) => (
                <PullRequestCard key={pr.id} pr={pr} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4" />
              <span>No pull requests linked to this task</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

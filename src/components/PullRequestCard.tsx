import { GitHubPR } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, GitBranch, User } from "lucide-react"

interface PullRequestCardProps {
  pr: GitHubPR
}

export function PullRequestCard({ pr }: PullRequestCardProps) {
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge className={getStatusColor(pr.status)}>
              #{pr.number} • {pr.status}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <GitBranch className="h-3 w-3" />
            <span className="font-mono">{pr.branch}</span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <User className="h-3 w-3" />
            <span>{pr.author}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

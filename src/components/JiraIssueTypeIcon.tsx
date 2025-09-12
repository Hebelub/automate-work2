import { Bug, FileText, CheckSquare, AlertTriangle, Zap, HelpCircle, Target, Layers } from "lucide-react"

interface JiraIssueTypeIconProps {
  issueType: string
  iconUrl?: string
  className?: string
  size?: number
  showTooltip?: boolean
}

export function JiraIssueTypeIcon({ 
  issueType, 
  iconUrl, 
  className = "h-4 w-4", 
  size = 16,
  showTooltip = true
}: JiraIssueTypeIconProps) {
  // If we have a Jira icon URL, use it
  if (iconUrl) {
    return (
      <div title={showTooltip ? issueType : undefined} className="inline-flex">
        <img
          src={iconUrl}
          alt={`${issueType} icon`}
          className={className}
          style={{ width: size, height: size }}
          onError={(e) => {
            // If the image fails to load, fall back to the default icon
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement
            if (fallback) {
              fallback.style.display = 'block'
            }
          }}
        />
      </div>
    )
  }

  // Fallback icons based on issue type
  const getFallbackIcon = () => {
    const type = issueType.toLowerCase()
    
    switch (type) {
      case 'bug':
      case 'devbug':
        return <Bug className={className} style={{ width: size, height: size }} />
      case 'story':
        return <FileText className={className} style={{ width: size, height: size }} />
      case 'task':
        return <CheckSquare className={className} style={{ width: size, height: size }} />
      case 'epic':
        return <Target className={className} style={{ width: size, height: size }} />
      case 'sub-task':
      case 'subtask':
        return <Layers className={className} style={{ width: size, height: size }} />
      case 'improvement':
        return <Zap className={className} style={{ width: size, height: size }} />
      case 'incident':
        return <AlertTriangle className={className} style={{ width: size, height: size }} />
      default:
        return <HelpCircle className={className} style={{ width: size, height: size }} />
    }
  }

  return (
    <div title={showTooltip ? issueType : undefined} className="inline-flex">
      {getFallbackIcon()}
    </div>
  )
}

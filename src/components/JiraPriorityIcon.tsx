import { ArrowUp, ArrowDown, Minus, AlertTriangle, Zap } from "lucide-react"

interface JiraPriorityIconProps {
  priority: string
  iconUrl?: string
  className?: string
  size?: number
  showTooltip?: boolean
}

export function JiraPriorityIcon({ 
  priority, 
  iconUrl, 
  className = "h-4 w-4", 
  size = 16,
  showTooltip = true
}: JiraPriorityIconProps) {
  // If we have a Jira icon URL, use it
  if (iconUrl) {
    return (
      <div title={showTooltip ? priority : undefined} className="inline-flex">
        <img
          src={iconUrl}
          alt={`${priority} priority icon`}
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

  // Fallback icons based on priority
  const getFallbackIcon = () => {
    const priorityLower = priority.toLowerCase()
    
    switch (priorityLower) {
      case 'highest':
      case 'critical':
      case 'urgent':
        return <AlertTriangle className={className} style={{ width: size, height: size }} />
      case 'high':
        return <ArrowUp className={className} style={{ width: size, height: size }} />
      case 'medium':
      case 'normal':
        return <Minus className={className} style={{ width: size, height: size }} />
      case 'low':
        return <ArrowDown className={className} style={{ width: size, height: size }} />
      case 'lowest':
      case 'trivial':
        return <ArrowDown className={className} style={{ width: size, height: size }} />
      default:
        return <Zap className={className} style={{ width: size, height: size }} />
    }
  }

  return (
    <div title={showTooltip ? priority : undefined} className="inline-flex">
      {getFallbackIcon()}
    </div>
  )
}

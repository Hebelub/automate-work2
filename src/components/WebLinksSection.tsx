import { JiraWebLink } from "@/types"
import { ExternalLink, ChevronDown, ChevronRight } from "lucide-react"

interface WebLinksSectionProps {
  webLinks: JiraWebLink[]
  isExpanded: boolean
  onToggle: () => void
}

export function WebLinksSection({ webLinks, isExpanded, onToggle }: WebLinksSectionProps) {
  // Only show the section if there are web links
  if (webLinks.length === 0) {
    return null
  }

  return (
    <div className="pt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors w-full text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Web Links ({webLinks.length})
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {webLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {link.iconUrl && (
                  <img 
                    src={link.iconUrl} 
                    alt="" 
                    className="h-4 w-4 flex-shrink-0" 
                  />
                )}
                <span className="font-medium text-gray-900 truncate">
                  {link.title}
                </span>
              </div>
              <button
                onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0 ml-2"
                title="Open link"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

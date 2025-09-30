import { JiraWebLink } from "@/types"
import { ChevronDown, ChevronRight, Copy, Check, Trash2 } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"

interface WebLinksSectionProps {
  webLinks: JiraWebLink[]
  isExpanded: boolean
  onToggle: () => void
  taskId: string
  onWebLinkDeleted: () => void
}

// Helper function to format URL for display
function formatUrlForDisplay(url: string): string {
  // Strip https://beta.24sevenoffice.com/ if the URL starts with it
  if (url.startsWith('https://beta.24sevenoffice.com/')) {
    return url.replace('https://beta.24sevenoffice.com/', '')
  }
  return url
}

export function WebLinksSection({ 
  webLinks, 
  isExpanded, 
  onToggle,
  taskId,
  onWebLinkDeleted
}: WebLinksSectionProps) {
  // Only show the section if there are web links
  if (webLinks.length === 0) {
    return null
  }

  const handleDeleteWebLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this web link?')) {
      return
    }

    try {
      const response = await fetch(`/api/delete-web-link?taskId=${taskId}&linkId=${linkId}`, {
        method: 'DELETE',
      })

      const result = await response.json()
      
      if (result.success) {
        onWebLinkDeleted()
      } else {
        alert(result.error || 'Failed to delete web link')
      }
    } catch (error) {
      alert('An unexpected error occurred while deleting the web link')
      console.error('Error deleting web link:', error)
    }
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
              className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm"
            >
              {/* Name */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {link.iconUrl && (
                  <img 
                    src={link.iconUrl} 
                    alt="" 
                    className="h-4 w-4" 
                  />
                )}
                <span className="font-medium text-gray-900">
                  {link.title}
                </span>
              </div>
              
              {/* URL with Copy and Delete Buttons */}
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-blue-600 hover:underline transition-colors truncate"
                  title={link.url}
                >
                  {formatUrlForDisplay(link.url)}
                </a>
                <CopyButton
                  textToCopy={link.url}
                  tooltip="Copy URL"
                  className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  icon={<Copy className="h-3 w-3" />}
                  successIcon={<Check className="h-3 w-3 text-green-600" />}
                />
                <button
                  onClick={() => handleDeleteWebLink(link.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0 p-1"
                  title="Delete web link"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { Link as LinkIcon } from "lucide-react"
import { generateTestChannelUrl, findLatestWebsiteAccountingBranch } from "@/lib/utils"

interface WebLinkButtonProps {
  taskId: string
  pullRequests: any[]
  onAddWebLink?: (taskId: string, title: string, url: string) => void
}

export function WebLinkButton({ 
  taskId, 
  pullRequests, 
  onAddWebLink 
}: WebLinkButtonProps) {
  const handleAddWebLink = () => {
    // Find the latest branch from tfso/website-accounting and generate URL
    const latestBranch = findLatestWebsiteAccountingBranch(pullRequests)
    const testChannelUrl = latestBranch ? generateTestChannelUrl(latestBranch) : ""
    
    // Open Jira in a new tab to add the web link
    const jiraUrl = `https://${process.env.NEXT_PUBLIC_JIRA_DOMAIN || 'your-domain.atlassian.net'}/browse/${taskId}`
    
    // Show a helpful message about the test channel URL if available
    if (testChannelUrl) {
      const message = `To add a web link:\n\n1. Click "Add or create related work" in Jira\n2. Select "Add web link"\n3. Use this suggested URL: ${testChannelUrl}\n4. Title: "Test Channel"`
      alert(message)
    }
    
    window.open(jiraUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={handleAddWebLink}
      className="text-gray-500 hover:text-gray-700 transition-colors"
      title="Add web link (opens Jira with instructions)"
    >
      <LinkIcon className="h-4 w-4" />
    </button>
  )
}

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, X, Edit, RotateCcw } from "lucide-react"
import { generateTestChannelUrl, findLatestWebsiteAccountingBranch, findApiWorkerVoucherJiraTask } from "@/lib/utils"
import { JiraWebLink } from "@/types"

interface AddWebLinkFormProps {
  taskId: string
  pullRequests: any[]
  onWebLinkAdded: () => void
  onCancel: () => void
  editingWebLink?: JiraWebLink
}

export function AddWebLinkForm({ 
  taskId, 
  pullRequests, 
  onWebLinkAdded,
  onCancel,
  editingWebLink
}: AddWebLinkFormProps) {
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalPrefilledValues, setOriginalPrefilledValues] = useState<{title: string, url: string} | null>(null)

  // Find the latest branch from tfso/website-accounting and generate URL
  const latestBranch = findLatestWebsiteAccountingBranch(pullRequests)
  const jiraTaskKey = findApiWorkerVoucherJiraTask(pullRequests)
  const testChannelUrl = latestBranch ? generateTestChannelUrl(latestBranch, jiraTaskKey || undefined) : ""

  // Generate title with current date
  const generateTestChannelTitle = () => {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    return `Test Channel (${day}.${month}.${year})`
  }

  // Initialize title and URL when component mounts or when editingWebLink changes
  useEffect(() => {
    if (editingWebLink) {
      // Editing mode: populate with existing values
      setTitle(editingWebLink.title)
      setUrl(editingWebLink.url)
      // Store the original prefilled values for reset functionality
      setOriginalPrefilledValues({
        title: generateTestChannelTitle(),
        url: testChannelUrl
      })
    } else {
      // Adding mode: use defaults
      const defaultTitle = generateTestChannelTitle()
      setTitle(defaultTitle)
      if (testChannelUrl) {
        setUrl(testChannelUrl)
      }
      // Store the original prefilled values for reset functionality
      setOriginalPrefilledValues({
        title: defaultTitle,
        url: testChannelUrl
      })
    }
  }, [editingWebLink, testChannelUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !url.trim()) {
      setError("Please fill in both title and URL")
      return
    }

    // Basic URL validation
    try {
      new URL(url)
    } catch {
      setError("Please enter a valid URL")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // If editing, we need to add the new one first, then delete the old one
      if (editingWebLink) {
        // Step 1: Add the new web link
        const addResponse = await fetch('/api/add-web-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId: taskId,
            title: title.trim(),
            url: url.trim()
          })
        })

        const addResult = await addResponse.json()
        
        if (!addResult.success) {
          setError(addResult.error || "Failed to add updated web link")
          return
        }

        // Step 2: Delete the old web link
        const deleteResponse = await fetch(`/api/delete-web-link?taskId=${taskId}&linkId=${editingWebLink.id}`, {
          method: 'DELETE',
        })

        const deleteResult = await deleteResponse.json()
        
        if (!deleteResult.success) {
          setError(deleteResult.error || "Failed to remove old web link")
          return
        }

        onWebLinkAdded()
        setError(null)
      } else {
        // Adding new web link
        const response = await fetch('/api/add-web-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId: taskId,
            title: title.trim(),
            url: url.trim()
          })
        })

        const result = await response.json()
        
        if (result.success) {
          onWebLinkAdded()
          // Reset form with new date
          setTitle(generateTestChannelTitle())
          setUrl(testChannelUrl)
          setError(null)
        } else {
          setError(result.error || "Failed to add web link")
        }
      }
    } catch (error) {
      setError("An unexpected error occurred")
      console.error("Error with web link operation:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleResetToPrefilled = () => {
    if (originalPrefilledValues) {
      setTitle(originalPrefilledValues.title)
      setUrl(originalPrefilledValues.url)
      setError(null)
    }
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded border">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="w-1/6">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Title"
              disabled={isLoading}
            />
          </div>
          <div className="flex-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="https://example.com"
              disabled={isLoading}
            />
          </div>
          {editingWebLink && originalPrefilledValues && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToPrefilled}
              disabled={isLoading}
              className="px-3 h-8"
              title="Reset to prefilled values"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !title.trim() || !url.trim()}
            className="px-3 h-8"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              editingWebLink ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="px-2 h-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="text-xs text-red-600">
            {error}
          </div>
        )}
      </form>
    </div>
  )
}

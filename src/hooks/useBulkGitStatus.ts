import { useState, useEffect, useCallback } from 'react'
import { GitHubPR } from '@/types'
import { updatePRGitStatus } from '@/lib/jiraMetadataService'

interface GitStatusResult {
  prId: string
  status: any | null
  error: string | null
}

export function useBulkGitStatus(pullRequests: GitHubPR[], onUpdateMetadata: (prId: string, updates: any) => void) {
  const [isLoading, setIsLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  const fetchBulkGitStatus = useCallback(async () => {
    if (isLoading || hasFetched) return

    // Filter PRs that don't have local git status yet
    const prsToFetch = pullRequests.filter(pr => !pr.localGitStatus)
    
    if (prsToFetch.length === 0) {
      setHasFetched(true)
      return
    }

    setIsLoading(true)

    try {
      // Prepare PR data for bulk request
      const prsData = prsToFetch.map(pr => ({
        id: pr.id,
        repository: pr.repository,
        branch: pr.branch
      }))

      const response = await fetch(`/api/local-git?action=bulk-status&prs=${encodeURIComponent(JSON.stringify(prsData))}`)
      
      if (response.ok) {
        const results: GitStatusResult[] = await response.json()
        
        // Update each PR with its git status
        results.forEach(result => {
          if (result.status && result.status.exists) {
            updatePRGitStatus(result.prId, result.status)
            onUpdateMetadata(result.prId, { localGitStatus: result.status })
          }
        })
      }
    } catch (error) {
      console.error('Error fetching bulk git status:', error)
    } finally {
      setIsLoading(false)
      setHasFetched(true)
    }
  }, [pullRequests, isLoading, hasFetched, onUpdateMetadata])

  // Auto-fetch after a delay to let the main content load first
  useEffect(() => {
    if (pullRequests.length > 0 && !hasFetched) {
      const timer = setTimeout(() => {
        fetchBulkGitStatus()
      }, 1000) // 1 second delay to let main content load first

      return () => clearTimeout(timer)
    }
  }, [pullRequests, hasFetched, fetchBulkGitStatus])

  return {
    isLoading,
    hasFetched,
    fetchBulkGitStatus
  }
}

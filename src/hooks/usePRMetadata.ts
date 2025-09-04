import { useState, useEffect } from 'react'
import { PullRequestMetadata, getAllPRMetadata, updatePRMetadata } from '@/lib/jiraMetadataService'
import { GitHubPR } from '@/types'

export function usePRMetadata(pullRequests: GitHubPR[]) {
  const [metadata, setMetadata] = useState<Record<string, PullRequestMetadata>>({})

  useEffect(() => {
    // Load metadata from localStorage
    const allMetadata = getAllPRMetadata()
    setMetadata(allMetadata)
  }, [])

  // Function to update PR metadata
  const updatePRMetadataState = (prId: string, updates: Partial<PullRequestMetadata>) => {
    // Save to localStorage first
    updatePRMetadata(prId, updates)
    
    // Then update React state
    setMetadata(prev => {
      const existingMetadata = prev[prId] || {
        id: prId,
        hidden: false
      }
      
      const updated = {
        ...prev,
        [prId]: {
          ...existingMetadata,
          ...updates
        }
      }
      return updated
    })
  }

  // Function to get PRs with metadata applied
  const getPRsWithMetadata = (): (GitHubPR & PullRequestMetadata)[] => {
    return pullRequests.map(pr => {
      const prMetadata = metadata[pr.id] || {
        id: pr.id,
        hidden: false
      }
      
      return {
        ...pr,
        ...prMetadata
      }
    })
  }

  // Function to get visible PRs (not hidden)
  const getVisiblePRs = (): (GitHubPR & PullRequestMetadata)[] => {
    return getPRsWithMetadata().filter(pr => !pr.hidden)
  }

  // Function to get hidden PRs
  const getHiddenPRs = (): (GitHubPR & PullRequestMetadata)[] => {
    return getPRsWithMetadata().filter(pr => pr.hidden)
  }

  // Function to get PRs sorted with hidden ones at the bottom
  const getPRsSortedByVisibility = (): (GitHubPR & PullRequestMetadata)[] => {
    return getPRsWithMetadata().sort((a, b) => {
      // Sort so hidden PRs appear at the bottom
      if (a.hidden && !b.hidden) return 1
      if (!a.hidden && b.hidden) return -1
      return 0
    })
  }

  return {
    metadata,
    updatePRMetadata: updatePRMetadataState,
    getPRsWithMetadata,
    getVisiblePRs,
    getHiddenPRs,
    getPRsSortedByVisibility
  }
}

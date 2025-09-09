import { useState, useEffect, useCallback, useRef } from 'react'
import { ReviewGitHubPR } from '@/types'

interface UseReviewInboxReturn {
  prs: ReviewGitHubPR[]
  hasNewPRs: boolean
  lastUpdateTime: Date | null
  refresh: () => Promise<void>
}

export function useReviewInbox(): UseReviewInboxReturn {
  const [prs, setPRs] = useState<ReviewGitHubPR[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasNewPRs, setHasNewPRs] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [lastPRCount, setLastPRCount] = useState(0)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoad = useRef(true)

  const fetchReviewPRs = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log('Fetching review PRs...')
      
      const response = await fetch('/api/review-inbox')
      if (response.ok) {
        const newPRs = await response.json()
        const currentTime = new Date()
        
        // Check if there are new PRs
        if (!isInitialLoad.current && newPRs.length > lastPRCount) {
          setHasNewPRs(true)
          console.log(`New PRs detected! Count increased from ${lastPRCount} to ${newPRs.length}`)
        }
        
        setPRs(newPRs)
        setLastPRCount(newPRs.length)
        setLastUpdateTime(currentTime)
        isInitialLoad.current = false
      } else {
        console.error('Failed to fetch review PRs:', response.status)
      }
    } catch (error) {
      console.error('Error fetching review PRs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [lastPRCount])

  const refresh = useCallback(async () => {
    await fetchReviewPRs()
  }, [fetchReviewPRs])


  // Initial load
  useEffect(() => {
    fetchReviewPRs()
  }, [fetchReviewPRs])

  // Set up polling interval
  useEffect(() => {
    // Poll every 30 seconds for updates
    intervalRef.current = setInterval(() => {
      fetchReviewPRs()
    }, 30000) // 30 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchReviewPRs])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    prs,
    hasNewPRs,
    lastUpdateTime,
    refresh
  }
}

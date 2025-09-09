import { NextRequest, NextResponse } from 'next/server'
import { getPRsNeedingReview } from '@/lib/workService'

export async function GET(request: NextRequest) {
  try {
    console.log('API: Fetching PRs needing review...')
    
    const reviewPRs = await getPRsNeedingReview()
    
    console.log(`API: Found ${reviewPRs.length} PRs needing review`)
    
    return NextResponse.json(reviewPRs)
  } catch (error) {
    console.error('API: Error fetching PRs needing review:', error)
    return NextResponse.json(
      { error: 'Failed to fetch PRs needing review' },
      { status: 500 }
    )
  }
}

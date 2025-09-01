import { NextRequest, NextResponse } from 'next/server'
import { getTasksWithPRs, clearPRCache } from '@/lib/workService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repo = searchParams.get('repo') || undefined
    const refresh = searchParams.get('refresh')
    
    // Clear cache if refresh parameter is present
    if (refresh) {
      clearPRCache()
    }
    
    const tasks = await getTasksWithPRs(repo)
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}

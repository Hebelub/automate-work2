import { NextRequest, NextResponse } from 'next/server'
import { getTasksWithPRs, clearPRCache, combineTasksWithLocalBranches } from '@/lib/workService'
import { checkGitHubRateLimit } from '@/lib/githubService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repo = searchParams.get('repo') || undefined
    const refresh = searchParams.get('refresh')
    const action = searchParams.get('action')
    
    // Clear cache if refresh parameter is present
    if (refresh) {
      clearPRCache()
    }
    
    
    const tasks = await getTasksWithPRs(repo)
    
    // Get the current rate limit status after all API calls
    const rateLimit = await checkGitHubRateLimit()
    
    return NextResponse.json({ 
      tasks, 
      rateLimit 
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, tasks } = body
    
    if (action === 'local-branches') {
      // Phase 2: Combine existing tasks with local branches
      console.log('Phase 2 API called with tasks:', tasks ? tasks.length : 'missing')
      
      if (!tasks) {
        console.log('Phase 2 API: No tasks provided')
        return NextResponse.json({ error: 'Tasks are required' }, { status: 400 })
      }
      
      try {
        console.log(`Phase 2 API: Processing ${tasks.length} tasks`)
        const tasksWithBranches = await combineTasksWithLocalBranches(tasks)
        console.log(`Phase 2 API: Returning ${tasksWithBranches.length} tasks with branches`)
        return NextResponse.json({ 
          tasks: tasksWithBranches,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('Phase 2 API: Error processing tasks:', error)
        return NextResponse.json({ error: 'Error processing tasks' }, { status: 500 })
      }
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

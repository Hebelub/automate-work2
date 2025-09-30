import { NextRequest, NextResponse } from 'next/server'
import { addRemoteLink } from '@/lib/jiraService'

export async function POST(request: NextRequest) {
  try {
    const { taskId, title, url } = await request.json()

    if (!taskId || !title || !url) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: taskId, title, url' },
        { status: 400 }
      )
    }

    const result = await addRemoteLink(taskId, title, url)
    
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in add-web-link API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

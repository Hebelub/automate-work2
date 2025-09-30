import { NextResponse } from 'next/server'
import { deleteRemoteLink } from '@/lib/jiraService'

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const linkId = searchParams.get('linkId')

    if (!taskId || !linkId) {
      return NextResponse.json({ success: false, error: 'Missing taskId or linkId' }, { status: 400 })
    }

    const result = await deleteRemoteLink(taskId, linkId)

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Failed to delete web link' }, { status: 500 })
    }
  } catch (error) {
    console.error('API error deleting web link:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

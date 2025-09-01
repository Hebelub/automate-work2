import { NextResponse } from 'next/server'
import { getTasksWithPRs } from '@/lib/workService'

export async function GET() {
  try {
    const tasks = await getTasksWithPRs()
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}

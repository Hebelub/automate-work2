import { NextResponse } from 'next/server'
import { clearAllCaches } from '@/lib/workService'

export async function POST() {
  try {
    clearAllCaches()
    return NextResponse.json({ success: true, message: 'All caches cleared' })
  } catch (error) {
    console.error('Error clearing caches:', error)
    return NextResponse.json({ success: false, error: 'Failed to clear caches' }, { status: 500 })
  }
}

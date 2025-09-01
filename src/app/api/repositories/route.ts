import { NextResponse } from 'next/server'
import { fetchUserRepositories } from '@/lib/githubService'

export async function GET() {
  try {
    const repositories = await fetchUserRepositories()
    return NextResponse.json({ repositories })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    )
  }
}

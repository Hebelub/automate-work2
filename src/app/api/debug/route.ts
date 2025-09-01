import { NextResponse } from 'next/server'

const JIRA_DOMAIN = process.env.JIRA_DOMAIN
const JIRA_EMAIL = process.env.JIRA_EMAIL
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN

export async function GET() {
  if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return NextResponse.json({ error: 'JIRA credentials not configured' })
  }

  try {
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
    
    const response = await fetch(
      `https://${JIRA_DOMAIN}/rest/api/3/search?jql=assignee=currentUser() AND status != Done ORDER BY priority DESC&maxResults=3&expand=sprint`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`JIRA API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Return the first issue with its fields for debugging
    const debugIssue = data.issues[0] || null
    
    return NextResponse.json({
      totalIssues: data.total,
      debugIssue,
      allFields: debugIssue ? Object.keys(debugIssue.fields) : [],
      sprintField: debugIssue?.fields?.sprint || null,
    })
  } catch (error) {
    console.error('Debug API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch debug data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const JIRA_DOMAIN = process.env.JIRA_DOMAIN
    const JIRA_EMAIL = process.env.JIRA_EMAIL
    const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN

    if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
      return NextResponse.json({
        error: 'JIRA environment variables not configured'
      }, { status: 400 })
    }

    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
    
    // Test different JQL queries to find what works
    const testQueries = [
      {
        name: 'Simple assignee query',
        jql: 'assignee=currentUser()'
      },
      {
        name: 'Assignee with status filter',
        jql: 'assignee=currentUser() AND status != "Done"'
      },
      {
        name: 'Assignee with status NOT IN',
        jql: 'assignee=currentUser() AND status NOT IN ("Done", "Rejected")'
      },
      {
        name: 'Assignee with priority order',
        jql: 'assignee=currentUser() ORDER BY priority DESC'
      },
      {
        name: 'Full query without expand',
        jql: 'assignee=currentUser() AND status NOT IN ("Done", "Rejected") ORDER BY priority DESC'
      }
    ]

    const results = []

    for (const test of testQueries) {
      try {
        console.log(`Testing: ${test.name} - ${test.jql}`)
        
        const response = await fetch(
          `https://${JIRA_DOMAIN}/rest/api/3/search/jql?jql=${encodeURIComponent(test.jql)}&maxResults=5`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          results.push({
            name: test.name,
            jql: test.jql,
            status: 'SUCCESS',
            total: data.total,
            issues: data.issues.length,
            sampleIssues: data.issues.slice(0, 2).map((issue: any) => ({
              key: issue.key,
              summary: issue.fields.summary,
              status: issue.fields.status.name
            }))
          })
        } else {
          const errorText = await response.text()
          results.push({
            name: test.name,
            jql: test.jql,
            status: 'FAILED',
            error: `${response.status} ${response.statusText}`,
            details: errorText
          })
        }
      } catch (error) {
        results.push({
          name: test.name,
          jql: test.jql,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      jiraDomain: JIRA_DOMAIN,
      results
    })
  } catch (error) {
    console.error('JIRA Search Debug Error:', error)
    return NextResponse.json({
      error: 'Failed to test JIRA search queries',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

import { JiraTask } from "@/types"

const JIRA_DOMAIN = process.env.JIRA_DOMAIN
const JIRA_EMAIL = process.env.JIRA_EMAIL
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN

if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.warn('JIRA environment variables are not configured')
}

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')

// Helper function to extract full description from JIRA's complex structure
function extractFullDescription(description: any): string {
  if (!description || !description.content) {
    return ''
  }
  
  let fullText = ''
  
  // Recursively extract text from all content blocks
  function extractText(content: any[]) {
    if (!Array.isArray(content)) return
    
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        fullText += item.text
      } else if (item.content && Array.isArray(item.content)) {
        extractText(item.content)
      }
    }
  }
  
  extractText(description.content)
  return fullText.trim()
}

export async function fetchJiraTasks(): Promise<JiraTask[]> {
  if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.warn('JIRA credentials not configured, returning empty array')
    return []
  }

      // Try different JQL queries in order of complexity
    const jqlQueries = [
      `assignee=currentUser() AND status NOT IN ('Done', 'Rejected', 'DevBugs', 'Closed', 'Resolved') ORDER BY priority DESC`,
      `assignee=currentUser() AND status NOT IN ('Done', 'Rejected', 'DevBugs') ORDER BY priority DESC`,
      `assignee=currentUser() AND status NOT IN ('Done', 'Rejected') ORDER BY priority DESC`,
      `assignee=currentUser() ORDER BY priority DESC`,
      `assignee=currentUser() AND status != 'Done' ORDER BY priority DESC`,
      `assignee=currentUser()`
    ]

  for (const jqlQuery of jqlQueries) {
    try {
      console.log(`Trying JQL query: ${jqlQuery}`)
      
      // Fetch all tasks with pagination
      const allIssues: any[] = []
      let startAt = 0
      const maxResults = 100
      let hasMore = true

      while (hasMore) {
        const response = await fetch(
          `https://${JIRA_DOMAIN}/rest/api/3/search/jql?jql=${encodeURIComponent(jqlQuery)}&startAt=${startAt}&maxResults=${maxResults}&fields=*all`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`JIRA API error with query "${jqlQuery}": ${response.status} ${response.statusText}`)
          console.error('Error details:', errorText)
          throw new Error(`JIRA API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        allIssues.push(...data.issues)
        
        // Check if we have more results
        if (data.issues.length < maxResults || startAt + maxResults >= data.total) {
          hasMore = false
        } else {
          startAt += maxResults
        }
      }
      
      // If we get here, the query worked
      console.log(`Successfully fetched ${allIssues.length} issues with query: ${jqlQuery}`)
      
      
      return allIssues
        .filter((issue: any) => {
          // Filter out only actual subtasks, not tasks that are part of an epic
          const isSubtask = issue.fields?.issuetype?.name?.toLowerCase() === 'subtask' ||
                           issue.fields?.issuetype?.subtask === true
          return !isSubtask
        })
        .map((issue: any) => {
          
          // Check if task is in sprint - JIRA can store sprint info in different ways
          const isInSprint = checkIfInSprint(issue)
          
          return {
            id: issue.id || 'unknown',
            key: issue.key || 'unknown',
            name: issue.fields?.summary || 'No title',
            status: issue.fields?.status?.name || 'Unknown',
            issueType: issue.fields?.issuetype?.name || 'Unknown',
            isInSprint,
            assignee: issue.fields?.assignee?.displayName || 'Unassigned',
            priority: issue.fields?.priority?.name || 'Medium',
            description: extractFullDescription(issue.fields?.description),
            url: `https://${JIRA_DOMAIN}/browse/${issue.key || 'unknown'}`,
            lastJiraUpdate: issue.fields?.updated || undefined
          }
        })
    } catch (error) {
      console.error(`Failed with JQL query "${jqlQuery}":`, error)
      // Continue to next query
    }
  }
  
  // If all queries failed
  console.error('All JQL queries failed')
  return []
}



function checkIfInSprint(issue: any): boolean {
  // Method 1: Check customfield_10020 (sprint field) for active sprints
  if (issue.fields?.customfield_10020 && Array.isArray(issue.fields.customfield_10020)) {
    const sprints = issue.fields.customfield_10020
    // Check if any sprint is active
    const hasActiveSprint = sprints.some((sprint: any) => sprint.state === 'active')
    if (hasActiveSprint) {
      return true
    }
  }
  
  // Method 2: Check if sprint field exists and has content (fallback)
  if (issue.fields?.sprint && Array.isArray(issue.fields.sprint) && issue.fields.sprint.length > 0) {
    return true
  }
  
  // Method 3: Check if sprint field is a single object
  if (issue.fields?.sprint && typeof issue.fields.sprint === 'object') {
    return true
  }
  
  // Method 4: Check other custom fields that might contain sprint info
  if (issue.fields) {
    const customFields = Object.keys(issue.fields).filter(key => key.startsWith('customfield_'))
    for (const fieldKey of customFields) {
      const fieldValue = issue.fields[fieldKey]
      if (fieldValue && (typeof fieldValue === 'string' && fieldValue.toLowerCase().includes('sprint'))) {
        return true
      }
    }
  }
  
  // Method 5: Check if the issue has any sprint-related metadata
  if (issue.fields?.sprint && issue.fields.sprint !== null) {
    return true
  }
  
  return false
}

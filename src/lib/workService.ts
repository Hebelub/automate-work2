import { TaskWithPRs, JiraTask, GitHubPR } from "@/types"
import { fetchJiraTasks, fetchSprintTasks } from "./jiraService"
import { fetchPullRequests } from "./githubService"

export async function getTasksWithPRs(): Promise<TaskWithPRs[]> {
  try {
    // Fetch JIRA tasks and GitHub PRs in parallel
    const [jiraTasks, allPRs] = await Promise.all([
      fetchJiraTasks(),
      fetchPullRequests()
    ])

    // Combine tasks with their linked PRs
    return jiraTasks.map(task => ({
      ...task,
      pullRequests: allPRs.filter(pr => pr.linkedTaskKey === task.key)
    }))
  } catch (error) {
    console.error('Error fetching work data:', error)
    return []
  }
}

export async function getSprintTasksWithPRs(): Promise<TaskWithPRs[]> {
  try {
    const [sprintTasks, allPRs] = await Promise.all([
      fetchSprintTasks(),
      fetchPullRequests()
    ])

    return sprintTasks.map(task => ({
      ...task,
      pullRequests: allPRs.filter(pr => pr.linkedTaskKey === task.key)
    }))
  } catch (error) {
    console.error('Error fetching sprint data:', error)
    return []
  }
}

export async function getTasksByStatus(status: JiraTask['status']): Promise<TaskWithPRs[]> {
  const allTasks = await getTasksWithPRs()
  return allTasks.filter(task => task.status === status)
}

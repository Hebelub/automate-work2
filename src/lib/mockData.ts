import { TaskWithPRs, JiraTask, GitHubPR } from "@/types"

// Mock JIRA tasks
const mockJiraTasks: JiraTask[] = [
  {
    id: "1",
    key: "PROJ-123",
    name: "Implement user authentication system",
    status: "In Progress",
    issueType: "Story",
    isInSprint: true,
    assignee: "John Doe",
    priority: "High",
    description: "Create a comprehensive authentication system with JWT tokens and role-based access control.",
    url: "https://jira.company.com/browse/PROJ-123"
  },
  {
    id: "2",
    key: "PROJ-124",
    name: "Design responsive dashboard layout",
    status: "QA",
    issueType: "Task",
    isInSprint: true,
    assignee: "Jane Smith",
    priority: "Medium",
    description: "Create a responsive dashboard layout that works on all device sizes.",
    url: "https://jira.company.com/browse/PROJ-124"
  },
  {
    id: "3",
    key: "PROJ-125",
    name: "Fix critical security vulnerability",
    status: "Open",
    issueType: "Bug",
    isInSprint: false,
    assignee: "Mike Johnson",
    priority: "Critical",
    description: "Address the SQL injection vulnerability in the user input validation.",
    url: "https://jira.company.com/browse/PROJ-125"
  },
  {
    id: "4",
    key: "PROJ-126",
    name: "Add unit tests for API endpoints",
    status: "Done",
    issueType: "Task",
    isInSprint: true,
    assignee: "Sarah Wilson",
    priority: "Low",
    description: "Implement comprehensive unit tests for all API endpoints.",
    url: "https://jira.company.com/browse/PROJ-126"
  },
  {
    id: "5",
    key: "PROJ-127",
    name: "Optimize database queries",
    status: "On Hold",
    issueType: "Story",
    isInSprint: true,
    assignee: "Alex Brown",
    priority: "High",
    description: "Optimize slow database queries to improve application performance.",
    url: "https://jira.company.com/browse/PROJ-127"
  }
]

// Mock GitHub PRs
const mockGitHubPRs: GitHubPR[] = [
  {
    id: "1",
    title: "feat: implement JWT authentication",
    number: 45,
    status: "open",
    branch: "feature/PROJ-123",
    url: "https://github.com/company/repo/pull/45",
    author: "John Doe",
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-16T14:20:00Z",
    linkedTaskKey: "PROJ-123",
    repository: "company/repo",
    isDraft: false,
    reviewStatus: "pending",
    requestedReviewers: ["Jane Smith", "Mike Johnson"],
    approvedReviewers: []
  },
  {
    id: "2",
    title: "feat: add user login component",
    number: 46,
    status: "open",
    branch: "feature/PROJ-123",
    url: "https://github.com/company/repo/pull/46",
    author: "John Doe",
    createdAt: "2024-01-16T09:15:00Z",
    updatedAt: "2024-01-16T16:45:00Z",
    linkedTaskKey: "PROJ-123",
    repository: "company/repo",
    isDraft: false,
    reviewStatus: "approved",
    requestedReviewers: ["Jane Smith"],
    approvedReviewers: ["Jane Smith"]
  },
  {
    id: "3",
    title: "feat: responsive dashboard layout",
    number: 47,
    status: "open",
    branch: "feature/PROJ-124",
    url: "https://github.com/company/repo/pull/47",
    author: "Jane Smith",
    createdAt: "2024-01-14T11:00:00Z",
    updatedAt: "2024-01-16T13:30:00Z",
    linkedTaskKey: "PROJ-124",
    repository: "company/repo",
    isDraft: false,
    reviewStatus: "changes_requested",
    requestedReviewers: ["John Doe"],
    approvedReviewers: []
  },
  {
    id: "4",
    title: "fix: mobile navigation issues",
    number: 48,
    status: "merged",
    branch: "feature/PROJ-124",
    url: "https://github.com/company/repo/pull/48",
    author: "Jane Smith",
    createdAt: "2024-01-13T15:20:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    linkedTaskKey: "PROJ-124",
    repository: "company/repo",
    isDraft: false,
    reviewStatus: "approved",
    requestedReviewers: ["John Doe"],
    approvedReviewers: ["John Doe"]
  },
  {
    id: "5",
    title: "test: add API endpoint tests",
    number: 49,
    status: "merged",
    branch: "feature/PROJ-126",
    url: "https://github.com/company/repo/pull/49",
    author: "Sarah Wilson",
    createdAt: "2024-01-12T08:45:00Z",
    updatedAt: "2024-01-14T17:30:00Z",
    linkedTaskKey: "PROJ-126",
    repository: "company/repo",
    isDraft: false,
    reviewStatus: "approved",
    requestedReviewers: ["Mike Johnson"],
    approvedReviewers: ["Mike Johnson"]
  },
  {
    id: "6",
    title: "test: add integration tests",
    number: 50,
    status: "closed",
    branch: "feature/PROJ-126",
    url: "https://github.com/company/repo/pull/50",
    author: "Sarah Wilson",
    createdAt: "2024-01-11T12:00:00Z",
    updatedAt: "2024-01-13T09:15:00Z",
    linkedTaskKey: "PROJ-126",
    repository: "company/repo",
    isDraft: false,
    reviewStatus: "no_reviews",
    requestedReviewers: [],
    approvedReviewers: []
  },
  {
    id: "7",
    title: "feat: database query optimization",
    number: 51,
    status: "draft",
    branch: "feature/PROJ-127",
    url: "https://github.com/company/repo/pull/51",
    author: "Alex Brown",
    createdAt: "2024-01-16T07:30:00Z",
    updatedAt: "2024-01-16T07:30:00Z",
    linkedTaskKey: "PROJ-127",
    repository: "company/repo",
    isDraft: true,
    reviewStatus: "no_reviews",
    requestedReviewers: [],
    approvedReviewers: []
  }
]

// Function to combine JIRA tasks with their linked PRs
export function getTasksWithPRs(): TaskWithPRs[] {
  return mockJiraTasks.map(task => ({
    ...task,
    pullRequests: mockGitHubPRs.filter(pr => pr.linkedTaskKey === task.key)
  }))
}

// Function to get tasks by status
export function getTasksByStatus(status: JiraTask['status']): TaskWithPRs[] {
  return getTasksWithPRs().filter(task => task.status === status)
}



// Function to get all PRs
export function getAllPRs(): GitHubPR[] {
  return mockGitHubPRs
}

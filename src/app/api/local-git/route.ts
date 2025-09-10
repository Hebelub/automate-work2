import { NextRequest, NextResponse } from 'next/server'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

interface GitBranchStatus {
  branch: string
  exists: boolean
  isUpToDate: boolean
  ahead: number
  behind: number
  lastCommit?: string
  hasRemote: boolean
  repository?: string
}

interface GitRepositoryInfo {
  path: string
  branches: GitBranchStatus[]
  remotes: string[]
}

interface LocalBranchInfo {
  branch: string
  repository: string
  lastCommit?: string
  hasRemote: boolean
  isAhead: boolean
  aheadCount: number
  remoteOrigin?: string
}

// Helper function to find git repositories in common locations
function findGitRepositories(): string[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE
  if (!homeDir) return []

  const commonPaths = [
    homeDir,
    path.join(homeDir, 'repos'),
    path.join(homeDir, 'projects'),
    path.join(homeDir, 'work'),
    path.join(homeDir, 'code'),
  ]

  const repos: string[] = []

  for (const basePath of commonPaths) {
    if (!fs.existsSync(basePath)) continue

    try {
      const items = fs.readdirSync(basePath)
      for (const item of items) {
        const fullPath = path.join(basePath, item)
        if (fs.statSync(fullPath).isDirectory()) {
          const gitPath = path.join(fullPath, '.git')
          if (fs.existsSync(gitPath)) {
            repos.push(fullPath)
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      continue
    }
  }

  return repos
}

// Get branch status for a specific branch in a repository
async function getBranchStatus(repoPath: string, branchName: string): Promise<GitBranchStatus> {
  try {
    // Check if branch exists locally
    const branchesOutput = execSync('git branch --list', { cwd: repoPath, encoding: 'utf8' })
    const branches = branchesOutput.split('\n').map(b => b.trim().replace(/^[\*\+]\s*/, ''))
    const exists = branches.includes(branchName)

    if (!exists) {
      return {
        branch: branchName,
        exists: false,
        isUpToDate: false,
        ahead: 0,
        behind: 0,
        hasRemote: false,
        repository: path.basename(repoPath)
      }
    }

    // Check if remote tracking branch exists
    const remoteBranchesOutput = execSync('git branch -r', { cwd: repoPath, encoding: 'utf8' })
    const remoteBranches = remoteBranchesOutput.split('\n').map(b => b.trim())
    const remoteBranchName = `origin/${branchName}`
    const hasRemote = remoteBranches.includes(remoteBranchName)

    if (!hasRemote) {
      // Local branch exists but no remote tracking
      return {
        branch: branchName,
        exists: true,
        isUpToDate: false,
        ahead: 0,
        behind: 0,
        hasRemote: false,
        repository: path.basename(repoPath)
      }
    }

    // Get ahead/behind info
    const statusOutput = execSync(`git rev-list --left-right --count ${branchName}...${remoteBranchName}`, {
      cwd: repoPath,
      encoding: 'utf8'
    })
    const [ahead, behind] = statusOutput.trim().split('\t').map(Number)

    // Get last commit info
    const logOutput = execSync(`git log -1 --oneline ${branchName}`, {
      cwd: repoPath,
      encoding: 'utf8'
    }).trim()

    return {
      branch: branchName,
      exists: true,
      isUpToDate: ahead === 0 && behind === 0,
      ahead,
      behind,
      lastCommit: logOutput,
      hasRemote: true,
      repository: path.basename(repoPath)
    }
  } catch (error) {
    console.error(`Error checking branch status for ${branchName} in ${repoPath}:`, error)
    return {
      branch: branchName,
      exists: false,
      isUpToDate: false,
      ahead: 0,
      behind: 0,
      hasRemote: false,
      repository: path.basename(repoPath)
    }
  }
}

// Update branch (pull from remote)
async function updateBranch(repoPath: string, branchName: string): Promise<{ success: boolean; message: string }> {
  try {
    // Check if we're currently on this branch
    const currentBranchOutput = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath, encoding: 'utf8' }).trim()
    const wasOnBranch = currentBranchOutput === branchName

    // Switch to branch if not already on it
    if (!wasOnBranch) {
      execSync(`git checkout ${branchName}`, { cwd: repoPath })
    }

    // Pull from remote
    const pullOutput = execSync('git pull origin ' + branchName, { cwd: repoPath, encoding: 'utf8' })

    // Switch back if we weren't originally on this branch
    if (!wasOnBranch) {
      execSync(`git checkout ${currentBranchOutput}`, { cwd: repoPath })
    }

    return { success: true, message: 'Branch updated successfully' }
  } catch (error) {
    console.error(`Error updating branch ${branchName} in ${repoPath}:`, error)
    return { success: false, message: `Failed to update branch: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// Helper function to get the main branch name (master or main)
function getMainBranchName(repoPath: string): string {
  try {
    // First try to get the default branch from remote
    const remoteDefaultBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD', { cwd: repoPath, encoding: 'utf8' }).trim()
    if (remoteDefaultBranch) {
      return remoteDefaultBranch.replace('refs/remotes/origin/', '')
    }
  } catch (error) {
    // If remote default branch doesn't exist, try common names
  }

  // Check if master exists
  try {
    const masterExists = execSync('git show-ref --verify --quiet refs/heads/master', { cwd: repoPath, encoding: 'utf8' })
    return 'master'
  } catch (error) {
    // Master doesn't exist, try main
  }

  // Check if main exists
  try {
    const mainExists = execSync('git show-ref --verify --quiet refs/heads/main', { cwd: repoPath, encoding: 'utf8' })
    return 'main'
  } catch (error) {
    // Neither exists, default to main
    return 'main'
  }
}

// Delete branch locally
async function deleteBranch(repoPath: string, branchName: string): Promise<{ success: boolean; message: string }> {
  try {
    // Check if we're currently on this branch
    const currentBranchOutput = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath, encoding: 'utf8' }).trim()

    if (currentBranchOutput === branchName) {
      // We're on the branch we want to delete, checkout to main/master first
      const mainBranch = getMainBranchName(repoPath)
      
      try {
        // Try to checkout to the main branch
        execSync(`git checkout ${mainBranch}`, { cwd: repoPath })
        console.log(`Switched to ${mainBranch} before deleting ${branchName}`)
      } catch (checkoutError) {
        // If we can't checkout to main, try to create it from origin
        try {
          execSync(`git checkout -b ${mainBranch} origin/${mainBranch}`, { cwd: repoPath })
          console.log(`Created and switched to ${mainBranch} from origin before deleting ${branchName}`)
        } catch (createError) {
          return { 
            success: false, 
            message: `Cannot delete branch you are currently on. Failed to switch to ${mainBranch}: ${checkoutError instanceof Error ? checkoutError.message : 'Unknown error'}` 
          }
        }
      }
    }

    // Check if branch exists before trying to delete
    const branchesOutput = execSync('git branch --list', { cwd: repoPath, encoding: 'utf8' })
    const branches = branchesOutput.split('\n').map(b => b.trim().replace(/^[\*\+]\s*/, ''))
    const exists = branches.includes(branchName)

    if (!exists) {
      // Branch doesn't exist - treat as successful deletion
      return { success: true, message: 'Branch was already deleted' }
    }

    execSync(`git branch -D ${branchName}`, { cwd: repoPath })

    return { success: true, message: 'Branch deleted successfully' }
  } catch (error) {
    console.error(`Error deleting branch ${branchName} in ${repoPath}:`, error)
    return { success: false, message: `Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// Find repository by name
function findRepositoryByName(repoName: string): string | null {
  const repos = findGitRepositories()

  // If repoName contains a slash (like "owner/repo"), extract just the repo name
  const simpleRepoName = repoName.includes('/') ? repoName.split('/').pop() || repoName : repoName

  // Try exact match first
  let foundRepo = repos.find(repo => path.basename(repo).toLowerCase() === simpleRepoName.toLowerCase())

  // If not found, try case-insensitive partial match
  if (!foundRepo) {
    foundRepo = repos.find(repo => path.basename(repo).toLowerCase().includes(simpleRepoName.toLowerCase()))
  }

  return foundRepo || null
}

// Get remote origin URL for a repository
function getRemoteOrigin(repoPath: string): string | null {
  try {
    const originUrl = execSync('git remote get-url origin', { cwd: repoPath, encoding: 'utf8' }).trim()
    return originUrl
  } catch (error) {
    // Silently handle repositories without origin remote - this is normal
    return null
  }
}

// Get all local branches that match a JIRA task key pattern
export async function getLocalBranchesForTask(taskKey: string): Promise<LocalBranchInfo[]> {
  const repos = findGitRepositories()
  
  // Process all repositories in parallel
  const repoResults = await Promise.all(
    repos.map(async (repoPath) => {
      const repoName = path.basename(repoPath)
      const originUrl = getRemoteOrigin(repoPath)
      
      try {
        // Get all local branches
        const branchesOutput = execSync('git branch --list', { cwd: repoPath, encoding: 'utf8' })
        const branches = branchesOutput.split('\n')
          .map(b => b.trim().replace(/^[\*\+]\s*/, ''))
          .filter(b => b.length > 0)

        // Filter branches that match the task key
        const matchingBranchesInRepo = branches.filter(branch => 
          branch.toLowerCase().includes(taskKey.toLowerCase())
        )

        // Process all matching branches in parallel for this repository
        const branchResults = await Promise.all(
          matchingBranchesInRepo.map(async (branch) => {
            try {
              const status = await getBranchStatus(repoPath, branch)
              return {
                branch: branch,
                repository: repoName,
                lastCommit: status.lastCommit,
                hasRemote: status.hasRemote,
                isAhead: status.ahead > 0,
                aheadCount: status.ahead,
                remoteOrigin: originUrl || undefined
              }
            } catch (error) {
              console.error(`Error getting status for branch ${branch} in ${repoName}:`, error)
              return null
            }
          })
        )

        return branchResults.filter(result => result !== null)
      } catch (error) {
        console.error(`Error processing repository ${repoName}:`, error)
        return []
      }
    })
  )

  // Flatten all results
  const allBranches = repoResults.flat()

  // Apply deduplication logic - only deduplicate by branch name
  const processedBranches = new Set<string>()
  const finalBranches: LocalBranchInfo[] = []

  for (const branch of allBranches) {
    // const repoName = branch.repository (unused)
    // const originUrl = branch.remoteOrigin (unused)
    
    // REMOVED: Skip if we've already processed this repository name
    // REMOVED: Skip if we've already processed this remote origin
    // We want to show all branches from the same repository
    
    // Skip if we've already processed this branch name
    if (processedBranches.has(branch.branch)) {
      continue
    }
    
    // REMOVED: processedRepos.add(repoName)
    // REMOVED: processedOrigins.add(originUrl)
    processedBranches.add(branch.branch)
    
    finalBranches.push(branch)
  }

  return finalBranches
}

// Get ALL local branches from all repositories (for bulk processing)
// This is inefficient - it scans ALL branches in ALL repos, then filters later
export async function getAllLocalBranches(): Promise<LocalBranchInfo[]> {
  const startTime = Date.now()
  const repos = findGitRepositories()
  console.log(`Found ${repos.length} repositories to scan`)
  
  // Process all repositories in parallel
  const repoResults = await Promise.all(
    repos.map(async (repoPath, index) => {
      const repoStartTime = Date.now()
      const repoName = path.basename(repoPath)
      const originUrl = getRemoteOrigin(repoPath)
      
      try {
        // Get all branch information in one go using optimized Git commands
        const branchInfo = await getOptimizedBranchInfo(repoPath)
        const repoEndTime = Date.now()
        
        if (branchInfo.length > 0) {
          console.log(`Repo ${index + 1}/${repos.length}: ${repoName} - ${branchInfo.length} branches (${repoEndTime - repoStartTime}ms)`)
        }
        
        return branchInfo.map(branch => ({
          branch: branch.branch,
          repository: repoName,
          lastCommit: branch.lastCommit,
          hasRemote: branch.hasRemote,
          isAhead: branch.ahead > 0,
          aheadCount: branch.ahead,
          remoteOrigin: originUrl || undefined
        }))
      } catch (error) {
        console.error(`Error processing repository ${repoName}:`, error)
        return []
      }
    })
  )

  // Flatten all results
  const allBranches = repoResults.flat()

  // Apply deduplication logic - only deduplicate by branch name
  const processedBranches = new Set<string>()
  const finalBranches: LocalBranchInfo[] = []

  for (const branch of allBranches) {
    // const repoName = branch.repository (unused)
    // const originUrl = branch.remoteOrigin (unused)
    
    // REMOVED: Skip if we've already processed this repository name
    // REMOVED: Skip if we've already processed this remote origin
    // We want to show all branches from the same repository
    
    // Skip if we've already processed this branch name
    if (processedBranches.has(branch.branch)) {
      continue
    }
    
    // REMOVED: processedRepos.add(repoName)
    // REMOVED: processedOrigins.add(originUrl)
    processedBranches.add(branch.branch)
    
    finalBranches.push(branch)
  }

  const endTime = Date.now()
  console.log(`Total scan time: ${endTime - startTime}ms for ${repos.length} repos, found ${finalBranches.length} unique branches`)

  return finalBranches
}

// More efficient version that only scans branches matching specific task keys
export async function getLocalBranchesForTaskKeys(taskKeys: string[]): Promise<LocalBranchInfo[]> {
  const startTime = Date.now()
  const repos = findGitRepositories()
  console.log(`Found ${repos.length} repositories to scan for ${taskKeys.length} task keys`)
  
  // Create regex patterns for all task keys
  const taskKeyPatterns = taskKeys.map(key => 
    new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  )
  
  // Process all repositories in parallel
  const repoResults = await Promise.all(
    repos.map(async (repoPath, index) => {
      const repoStartTime = Date.now()
      const repoName = path.basename(repoPath)
      const originUrl = getRemoteOrigin(repoPath)
      
      try {
        // First, get just the branch names to filter
        const branchesOutput = execSync('git branch --list', { cwd: repoPath, encoding: 'utf8' })
        const allBranches = branchesOutput.split('\n')
          .map(b => b.trim().replace(/^[\*\+]\s*/, ''))
          .filter(b => b.length > 0)

        // Filter branches that match any of the task keys
        const relevantBranches = allBranches.filter(branch => 
          taskKeyPatterns.some(pattern => pattern.test(branch))
        )

        if (relevantBranches.length === 0) {
          return []
        }

        console.log(`Repo ${index + 1}/${repos.length}: ${repoName} - ${relevantBranches.length}/${allBranches.length} relevant branches`)

        // Get detailed info only for relevant branches
        const branchInfo = await getOptimizedBranchInfoForBranches(repoPath, relevantBranches)
        const repoEndTime = Date.now()
        
        console.log(`Repo ${index + 1}/${repos.length}: ${repoName} - processed ${branchInfo.length} branches (${repoEndTime - repoStartTime}ms)`)
        
        return branchInfo.map(branch => ({
          branch: branch.branch,
          repository: repoName,
          lastCommit: branch.lastCommit,
          hasRemote: branch.hasRemote,
          isAhead: branch.ahead > 0,
          aheadCount: branch.ahead,
          remoteOrigin: originUrl || undefined
        }))
      } catch (error) {
        console.error(`Error processing repository ${repoName}:`, error)
        return []
      }
    })
  )

  // Flatten all results
  const allBranches = repoResults.flat()

  // Apply deduplication logic - only deduplicate by branch name
  const processedBranches = new Set<string>()
  const finalBranches: LocalBranchInfo[] = []

  for (const branch of allBranches) {
    // Skip if we've already processed this branch name
    if (processedBranches.has(branch.branch)) {
      continue
    }
    
    processedBranches.add(branch.branch)
    finalBranches.push(branch)
  }

  const endTime = Date.now()
  console.log(`Optimized scan time: ${endTime - startTime}ms for ${repos.length} repos, found ${finalBranches.length} unique branches matching ${taskKeys.length} task keys`)

  return finalBranches
}

// Optimized function to get branch information for specific branches only
async function getOptimizedBranchInfoForBranches(repoPath: string, branchNames: string[]): Promise<GitBranchStatus[]> {
  if (branchNames.length === 0) {
    return []
  }

  try {
    // Get ahead/behind info for specific branches
    const statusOutput = execSync(`git for-each-ref --format="%(refname:short) %(upstream:short) %(upstream:track)" refs/heads/${branchNames.join(' refs/heads/')}`, { 
      cwd: repoPath, 
      encoding: 'utf8' 
    })
    
    const statusMap = new Map<string, { ahead: number; behind: number; hasRemote: boolean }>()
    
    if (statusOutput.trim()) {
      statusOutput.split('\n').forEach(line => {
        const parts = line.trim().split(' ')
        if (parts.length >= 2) {
          const branchName = parts[0]
          const upstream = parts[1]
          const track = parts[2] || ''
          
          if (upstream && upstream !== '') {
            const aheadMatch = track.match(/ahead (\d+)/)
            const behindMatch = track.match(/behind (\d+)/)
            const ahead = aheadMatch ? parseInt(aheadMatch[1]) : 0
            const behind = behindMatch ? parseInt(behindMatch[1]) : 0
            
            statusMap.set(branchName, { ahead, behind, hasRemote: true })
          } else {
            statusMap.set(branchName, { ahead: 0, behind: 0, hasRemote: false })
          }
        }
      })
    }

    // Get last commit for specific branches
    const logOutput = execSync(`git for-each-ref --format="%(refname:short) %(contents:subject)" refs/heads/${branchNames.join(' refs/heads/')}`, { 
      cwd: repoPath, 
      encoding: 'utf8' 
    })
    
    const commitMap = new Map<string, string>()
    if (logOutput.trim()) {
      logOutput.split('\n').forEach(line => {
        const parts = line.trim().split(' ', 2)
        if (parts.length >= 2) {
          commitMap.set(parts[0], parts[1])
        }
      })
    }

    // Build results
    return branchNames.map(branch => {
      const status = statusMap.get(branch) || { ahead: 0, behind: 0, hasRemote: false }
      const lastCommit = commitMap.get(branch) || ''
      
      return {
        branch,
        exists: true,
        isUpToDate: status.ahead === 0 && status.behind === 0,
        ahead: status.ahead,
        behind: status.behind,
        lastCommit,
        hasRemote: status.hasRemote,
        repository: path.basename(repoPath)
      }
    })
  } catch (error) {
    console.error(`Error getting optimized branch info for specific branches in ${repoPath}:`, error)
    return []
  }
}

// Optimized function to get all branch information with minimal Git commands
async function getOptimizedBranchInfo(repoPath: string): Promise<GitBranchStatus[]> {
  try {
    // Get all local branches in one command
    const branchesOutput = execSync('git branch --list', { cwd: repoPath, encoding: 'utf8' })
    const branches = branchesOutput.split('\n')
      .map(b => b.trim().replace(/^[\*\+]\s*/, ''))
      .filter(b => b.length > 0)

    if (branches.length === 0) {
      return []
    }

    // Get ahead/behind info for all branches in one command
    const statusOutput = execSync('git for-each-ref --format="%(refname:short) %(upstream:short) %(upstream:track)" refs/heads/', { 
      cwd: repoPath, 
      encoding: 'utf8' 
    })
    
    const statusMap = new Map<string, { ahead: number; behind: number; hasRemote: boolean }>()
    
    if (statusOutput.trim()) {
      statusOutput.split('\n').forEach(line => {
        const parts = line.trim().split(' ')
        if (parts.length >= 2) {
          const branchName = parts[0]
          const upstream = parts[1]
          const track = parts[2] || ''
          
          if (upstream && upstream !== '') {
            // Parse ahead/behind from track info (e.g., "[ahead 2, behind 1]")
            const aheadMatch = track.match(/ahead (\d+)/)
            const behindMatch = track.match(/behind (\d+)/)
            const ahead = aheadMatch ? parseInt(aheadMatch[1]) : 0
            const behind = behindMatch ? parseInt(behindMatch[1]) : 0
            
            statusMap.set(branchName, { ahead, behind, hasRemote: true })
          } else {
            statusMap.set(branchName, { ahead: 0, behind: 0, hasRemote: false })
          }
        }
      })
    }

    // Get last commit for all branches in one command
    const logOutput = execSync(`git for-each-ref --format="%(refname:short) %(contents:subject)" refs/heads/`, { 
      cwd: repoPath, 
      encoding: 'utf8' 
    })
    
    const commitMap = new Map<string, string>()
    if (logOutput.trim()) {
      logOutput.split('\n').forEach(line => {
        const parts = line.trim().split(' ', 2)
        if (parts.length >= 2) {
          commitMap.set(parts[0], parts[1])
        }
      })
    }

    // Build results
    return branches.map(branch => {
      const status = statusMap.get(branch) || { ahead: 0, behind: 0, hasRemote: false }
      const lastCommit = commitMap.get(branch) || ''
      
      return {
        branch,
        exists: true,
        isUpToDate: status.ahead === 0 && status.behind === 0,
        ahead: status.ahead,
        behind: status.behind,
        lastCommit,
        hasRemote: status.hasRemote,
        repository: path.basename(repoPath)
      }
    })
  } catch (error) {
    console.error(`Error getting optimized branch info for ${repoPath}:`, error)
    return []
  }
}

// Push branch to remote
async function pushBranch(repoPath: string, branchName: string): Promise<{ success: boolean; message: string }> {
  try {
    // Check if we're currently on this branch
    const currentBranchOutput = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath, encoding: 'utf8' }).trim()
    const wasOnBranch = currentBranchOutput === branchName

    // Check if the branch is being used by a worktree
    let isWorktreeBranch = false
    try {
      const worktreeListOutput = execSync('git worktree list', { cwd: repoPath, encoding: 'utf8' })
      isWorktreeBranch = worktreeListOutput.includes(branchName)
    } catch (error) {
      // If worktree command fails, assume it's not a worktree issue
      console.log('Could not check worktree status, proceeding with normal push')
    }

    // If branch is in a worktree, we can't checkout to it, so just push directly
    if (isWorktreeBranch) {
      console.log(`Branch ${branchName} is in a worktree, pushing without checkout`)
      const pushOutput = execSync(`git push -u origin ${branchName}`, { cwd: repoPath, encoding: 'utf8' })
      return { success: true, message: 'Branch pushed successfully (from worktree)' }
    }

    // Normal flow: switch to branch if not already on it
    if (!wasOnBranch) {
      execSync(`git checkout ${branchName}`, { cwd: repoPath })
    }

    // Push to remote (create upstream if it doesn't exist)
    const pushOutput = execSync(`git push -u origin ${branchName}`, { cwd: repoPath, encoding: 'utf8' })

    // Switch back if we weren't originally on this branch
    if (!wasOnBranch) {
      execSync(`git checkout ${currentBranchOutput}`, { cwd: repoPath })
    }

    return { success: true, message: 'Branch pushed successfully' }
  } catch (error) {
    console.error(`Error pushing branch ${branchName} in ${repoPath}:`, error)
    return { success: false, message: `Failed to push branch: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const repoName = searchParams.get('repo')
  const branchName = searchParams.get('branch')

  try {
    if (action === 'status' && repoName && branchName) {
      // Get status for specific branch
      const repoPath = findRepositoryByName(repoName)
      if (!repoPath) {
        return NextResponse.json({
          error: `Repository not found: ${repoName}. Make sure the repository exists locally and matches the expected name.`
        }, { status: 404 })
      }

      const status = await getBranchStatus(repoPath, branchName)
      return NextResponse.json(status)
    }

    if (action === 'repositories') {
      // List all available repositories
      const repos = findGitRepositories()
      const repoInfo: GitRepositoryInfo[] = []

      for (const repoPath of repos) {
        try {
          const remotesOutput = execSync('git remote -v', { cwd: repoPath, encoding: 'utf8' })
          const remotes = remotesOutput.split('\n')
            .filter(line => line.trim())
            .map(line => line.split('\t')[0])
            .filter((remote, index, arr) => arr.indexOf(remote) === index) // Remove duplicates

          repoInfo.push({
            path: repoPath,
            branches: [],
            remotes
          })
        } catch (error) {
          console.error(`Error reading remotes for ${repoPath}:`, error)
        }
      }

      return NextResponse.json(repoInfo)
    }

    if (action === 'all-status' && repoName) {
      // Get status for all branches in a repository
      const repoPath = findRepositoryByName(repoName)
      if (!repoPath) {
        return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
      }

      const branchesOutput = execSync('git branch --list', { cwd: repoPath, encoding: 'utf8' })
      const branches = branchesOutput.split('\n')
        .map(b => b.trim().replace(/^[\*\+]\s*/, ''))
        .filter(b => b.length > 0)

      const branchStatuses: GitBranchStatus[] = []
      for (const branch of branches) {
        const status = await getBranchStatus(repoPath, branch)
        branchStatuses.push(status)
      }

      return NextResponse.json(branchStatuses)
    }

    if (action === 'local-branches' && repoName) {
      // Get local branches that match a JIRA task key
      const taskKey = searchParams.get('taskKey')
      if (!taskKey) {
        return NextResponse.json({ error: 'Task key is required' }, { status: 400 })
      }

      const localBranches = await getLocalBranchesForTask(taskKey)
      return NextResponse.json(localBranches)
    }

    if (action === 'bulk-status') {
      // Get status for multiple branches at once
      const prsParam = searchParams.get('prs')
      if (!prsParam) {
        return NextResponse.json({ error: 'PRs parameter is required' }, { status: 400 })
      }

      try {
        const prs = JSON.parse(prsParam)
        const results = await Promise.all(
          prs.map(async (pr: { repository: string; branch: string; id: string }) => {
            const repoName = pr.repository?.split('/').pop() || 'unknown'
            const repoPath = findRepositoryByName(repoName)
            
            if (!repoPath) {
              return { prId: pr.id, status: null, error: 'Repository not found' }
            }

            try {
              const status = await getBranchStatus(repoPath, pr.branch)
              return { prId: pr.id, status, error: null }
            } catch (error) {
              return { prId: pr.id, status: null, error: error instanceof Error ? error.message : 'Unknown error' }
            }
          })
        )

        return NextResponse.json(results)
      } catch (error) {
        return NextResponse.json({ error: 'Invalid PRs parameter' }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 })

  } catch (error) {
    console.error('Error in local-git API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { action, repoName, branchName } = await request.json()

  try {
    if (action === 'update' && repoName && branchName) {
      const repoPath = findRepositoryByName(repoName)
      if (!repoPath) {
        return NextResponse.json({
          error: `Repository not found: ${repoName}. Make sure the repository exists locally and matches the expected name.`
        }, { status: 404 })
      }

      const result = await updateBranch(repoPath, branchName)
      return NextResponse.json(result)
    }

    if (action === 'delete' && repoName && branchName) {
      const repoPath = findRepositoryByName(repoName)
      if (!repoPath) {
        return NextResponse.json({
          error: `Repository not found: ${repoName}. Make sure the repository exists locally and matches the expected name.`
        }, { status: 404 })
      }

      const result = await deleteBranch(repoPath, branchName)
      return NextResponse.json(result)
    }

    if (action === 'push' && repoName && branchName) {
      const repoPath = findRepositoryByName(repoName)
      if (!repoPath) {
        return NextResponse.json({
          error: `Repository not found: ${repoName}. Make sure the repository exists locally and matches the expected name.`
        }, { status: 404 })
      }

      const result = await pushBranch(repoPath, branchName)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 })

  } catch (error) {
    console.error('Error in local-git API POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

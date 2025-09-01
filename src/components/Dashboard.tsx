"use client"

import { useState, useEffect } from "react"
import { JiraTaskCard } from "@/components/JiraTaskCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TaskWithPRs } from "@/types"
import { Clock, Users, Loader2, Filter, GitBranch, RefreshCw } from "lucide-react"

type SprintFilter = 'all' | 'sprint' | 'backlog'
type StatusFilter = 'all' | 'active' | 'completed'

export function Dashboard() {
  const [tasks, setTasks] = useState<TaskWithPRs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sprintFilter, setSprintFilter] = useState<SprintFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [repositories, setRepositories] = useState<Array<{id: number, name: string, full_name: string}>>([])
  const [selectedRepo, setSelectedRepo] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    async function loadRepositories() {
      try {
        const response = await fetch('/api/repositories')
        if (response.ok) {
          const data = await response.json()
          setRepositories(data.repositories || [])
        }
      } catch (error) {
        console.error('Failed to load repositories:', error)
      }
    }
    loadRepositories()
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        const url = selectedRepo && selectedRepo !== 'all' ? `/api/dashboard?repo=${encodeURIComponent(selectedRepo)}` : '/api/dashboard'
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.error) {
          throw new Error(data.error)
        }
        
        setTasks(data.tasks || [])
      } catch (err) {
        setError('Failed to load tasks')
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedRepo])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      setError(null)
             // Clear cache by adding a timestamp parameter
       const url = selectedRepo && selectedRepo !== 'all'
         ? `/api/dashboard?repo=${encodeURIComponent(selectedRepo)}&refresh=${Date.now()}` 
         : `/api/dashboard?refresh=${Date.now()}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setTasks(data.tasks || [])
    } catch (err) {
      setError('Failed to refresh data')
      console.error('Error refreshing dashboard data:', err)
    } finally {
      setRefreshing(false)
    }
  }

  // Filter tasks based on current filters
  const filteredTasks = tasks.filter(task => {
    // Sprint filter
    if (sprintFilter === 'sprint' && !task.isInSprint) return false
    if (sprintFilter === 'backlog' && task.isInSprint) return false
    
    // Status filter
    if (statusFilter === 'active' && (task.status === 'Done' || task.status === 'Rejected')) return false
    if (statusFilter === 'completed' && (task.status !== 'Done' && task.status !== 'Rejected')) return false
    
    return true
  })

  const sprintTasks = tasks.filter(task => task.isInSprint)
  const activeTasks = tasks.filter(task => task.status !== 'Done' && task.status !== 'Rejected')
  const completedTasks = tasks.filter(task => task.status === 'Done' || task.status === 'Rejected')
  const totalPRs = tasks.reduce((sum, task) => sum + task.pullRequests.length, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-600" />
          <p className="text-gray-600">Loading your work dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Work Dashboard</h1>
            </div>
                      <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="h-4 w-4" />
              <span>{tasks.length} Tasks</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>{sprintTasks.length} in Sprint</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Repository Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Repository:</span>
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="All repositories" />
                </SelectTrigger>
                                 <SelectContent>
                   <SelectItem value="all">All repositories</SelectItem>
                   {repositories.map((repo) => (
                     <SelectItem key={repo.id} value={repo.full_name}>
                       {repo.full_name}
                     </SelectItem>
                   ))}
                 </SelectContent>
              </Select>
            </div>

            {/* Sprint Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Sprint:</span>
              <div className="flex gap-1">
                <Button
                  variant={sprintFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSprintFilter('all')}
                >
                  All ({tasks.length})
                </Button>
                <Button
                  variant={sprintFilter === 'sprint' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSprintFilter('sprint')}
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Sprint ({sprintTasks.length})
                </Button>
                <Button
                  variant={sprintFilter === 'backlog' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSprintFilter('backlog')}
                >
                  Backlog ({tasks.length - sprintTasks.length})
                </Button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <div className="flex gap-1">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  All ({tasks.length})
                </Button>
                <Button
                  variant={statusFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                >
                  Active ({activeTasks.length})
                </Button>
                <Button
                  variant={statusFilter === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('completed')}
                >
                  Completed ({completedTasks.length})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Filtered Tasks
            </h2>
            <Badge variant="secondary">
              {filteredTasks.length} tasks
            </Badge>
          </div>
          <div className="text-sm text-gray-600">
            Total PRs: {totalPRs}
          </div>
        </div>

                 {/* Tasks Grid */}
         {filteredTasks.length > 0 ? (
           <div className="grid grid-cols-1 gap-6">
             {filteredTasks.map((task) => (
               <JiraTaskCard key={task.id} task={task} />
             ))}
           </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No tasks found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

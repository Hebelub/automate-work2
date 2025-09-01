"use client"

import { useState, useEffect } from "react"
import { JiraTaskCard } from "@/components/JiraTaskCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { TaskWithPRs } from "@/types"
import { Users, Loader2, Filter, RefreshCw } from "lucide-react"

export function Dashboard() {
  const [tasks, setTasks] = useState<TaskWithPRs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({
    'Open': true,
    'In Progress': true,
    'On Hold': true,
    'QA': true,
    'Ready for PROD': true,
    'Done': true,
    'Rejected': true,
  })
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/dashboard')
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.error) {
          throw new Error(data.error)
        }
        
        const fetchedTasks = data.tasks || []
        setTasks(fetchedTasks)
        
        // Debug: Log all unique status names to see what's actually coming from JIRA
        const actualStatuses = [...new Set(fetchedTasks.map((task: TaskWithPRs) => task.status))] as string[]
        console.log('Actual JIRA statuses found:', actualStatuses)
        console.log('Tasks with their statuses:', fetchedTasks.map((task: TaskWithPRs) => ({ key: task.key, status: task.status })))
      } catch (err) {
        setError('Failed to load tasks')
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      setError(null)
      // Clear cache by adding a timestamp parameter
      const response = await fetch(`/api/dashboard?refresh=${Date.now()}`)
      
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
    // Status filter - only show tasks whose status is enabled
    if (!statusFilters[task.status]) return false
    
    return true
  })

  const totalPRs = tasks.reduce((sum, task) => sum + task.pullRequests.length, 0)

  // Helper function to toggle status filter
  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
  }

  // Get status counts for display
  const statusCounts = Object.keys(statusFilters).reduce((acc, status) => {
    acc[status] = tasks.filter(task => task.status === status).length
    return acc
  }, {} as Record<string, number>)

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
               <span>{tasks.length} Total Tasks</span>
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

             {/* Status Filters */}
       <div className="bg-white border-b border-gray-200">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
           <div className="flex items-center gap-2">
             <span className="text-sm font-medium text-gray-700">Status:</span>
             <div className="flex flex-wrap gap-1">
               {Object.keys(statusFilters).map((status) => (
                 <Button
                   key={status}
                   variant={statusFilters[status] ? 'default' : 'outline'}
                   size="sm"
                   onClick={() => toggleStatusFilter(status)}
                   className="text-xs"
                 >
                   {status} ({statusCounts[status] || 0})
                 </Button>
               ))}
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

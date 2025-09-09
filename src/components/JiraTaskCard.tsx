import { TaskWithPRs } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PullRequestCard } from "@/components/PullRequestCard"
import { LocalBranches } from "@/components/LocalBranches"
import { ExternalLink, Clock, User, AlertTriangle, Copy, Check, Eye, EyeOff, X, Globe, Link, FileText, GripVertical, ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { toggleTaskHidden, setTaskNotes, setTaskParent, wouldCreateLoop } from "@/lib/jiraMetadataService"
import { usePRMetadata } from "@/hooks/usePRMetadata"
import { useBulkGitStatus } from "@/hooks/useBulkGitStatus"

interface JiraTaskCardProps {
  task: TaskWithPRs
  onUpdateMetadata: (taskId: string, updates: Partial<{ parentTaskId?: string; notes?: string; hidden: boolean; childTasksExpanded?: boolean; pullRequestsExpanded?: boolean; localBranchesExpanded?: boolean }>) => void
}

export function JiraTaskCard({ task, onUpdateMetadata }: JiraTaskCardProps) {
  const [copiedTaskKey, setCopiedTaskKey] = useState(false)
  const [notes, setNotes] = useState(task.notes || '')
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isAddingNotes, setIsAddingNotes] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  
  // PR metadata hook
  const { updatePRMetadata, getPRsSortedByVisibility } = usePRMetadata(task.pullRequests)
  
  // Bulk git status fetching hook
  const { isLoading: isLoadingGitStatus } = useBulkGitStatus(task.pullRequests, updatePRMetadata)

  const handleCopyTaskKey = () => {
    navigator.clipboard.writeText(task.key).then(() => {
      setCopiedTaskKey(true)
      setTimeout(() => setCopiedTaskKey(false), 2000)
    }).catch(() => {
      // Handle error if copying fails
    })
  }

  const handleToggleHidden = () => {
    const newHidden = !task.hidden
    toggleTaskHidden(task.id)
    onUpdateMetadata(task.id, { hidden: newHidden })
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = e.target.value
    setNotes(newNotes)
    setTaskNotes(task.id, newNotes)
    onUpdateMetadata(task.id, { notes: newNotes })
    
    // Auto-resize textarea
    if (notesRef.current) {
      notesRef.current.style.height = 'auto'
      notesRef.current.style.height = notesRef.current.scrollHeight + 'px'
    }
  }

  const handleAddNotes = () => {
    setIsAddingNotes(true)
    // Focus the textarea after it's rendered
    setTimeout(() => {
      if (notesRef.current) {
        notesRef.current.focus()
      }
    }, 0)
  }

  const handleToggleChildTasks = () => {
    onUpdateMetadata(task.id, { childTasksExpanded: !task.childTasksExpanded })
  }

  const handleTogglePullRequests = () => {
    onUpdateMetadata(task.id, { pullRequestsExpanded: !task.pullRequestsExpanded })
  }

  const handleToggleLocalBranches = () => {
    onUpdateMetadata(task.id, { localBranchesExpanded: !task.localBranchesExpanded })
  }

  // Auto-resize textarea on mount and when notes change
  useEffect(() => {
    if (notesRef.current && notes) {
      notesRef.current.style.height = 'auto'
      notesRef.current.style.height = notesRef.current.scrollHeight + 'px'
    }
  }, [notes])

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id)
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const draggedTaskId = e.dataTransfer.getData('text/plain')
    if (draggedTaskId && draggedTaskId !== task.id) {
      // Check if this would create a loop
      if (wouldCreateLoop(draggedTaskId, task.id)) {
        console.warn('Cannot set parent: would create a loop')
        return
      }
      
      setTaskParent(draggedTaskId, task.id)
      // Update the dragged task's parent in the UI
      onUpdateMetadata(draggedTaskId, { parentTaskId: task.id })
    }
  }

  const handleRemoveParent = () => {
    setTaskParent(task.id, undefined)
    onUpdateMetadata(task.id, { parentTaskId: undefined })
  }

  const getStatusColor = (status: TaskWithPRs['status']) => {
    switch (status) {
      case 'Open':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'On Hold':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'QA':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Ready for PROD':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityColor = (priority: TaskWithPRs['priority']) => {
    switch (priority) {
      case 'Low':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'Medium':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getIssueTypeColor = (issueType: string) => {
    switch (issueType.toLowerCase()) {
      case 'bug':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'story':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'task':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'sub-task':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'epic':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    }
  }

  // If task is hidden, show compact version
  if (task.hidden) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border text-sm">
        <button
          onClick={handleToggleHidden}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          title="Show task"
        >
          <Eye className="h-4 w-4" />
        </button>
        <span className="font-mono text-gray-600">{task.key}</span>
        <span className="text-gray-800 truncate">{task.name}</span>
        <Badge className={getStatusColor(task.status)}>
          {task.status}
        </Badge>
      </div>
    )
  }

  return (
    <Card 
      ref={cardRef}
      className={`hover:shadow-lg transition-shadow ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-blue-500' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-mono text-gray-600">{task.key}</span>
              <button
                onClick={handleCopyTaskKey}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Copy task key"
              >
                {copiedTaskKey ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              </button>
              
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
              <Badge className={getIssueTypeColor(task.issueType)}>
                {task.issueType}
              </Badge>
              {task.priority !== 'Medium' && task.priority !== 'Normal' && (
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
              )}
              {!task.isInSprint && (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Not in Sprint
                </Badge>
              )}
            </div>
            
            <CardTitle className="text-lg font-semibold mb-3">
              {task.name}
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Drag Handle */}
            <div
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
              draggable
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              title="Drag to move or set parent"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            
            {/* Detach Parent Button - only show if task has a parent */}
            {task.parentTaskId && (
              <button
                onClick={handleRemoveParent}
                className="text-red-500 hover:text-red-700 transition-colors"
                title="Detach from parent"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            
            {/* Add Notes Button - only show if no notes */}
            {!notes && !isAddingNotes && (
              <button
                onClick={handleAddNotes}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Add notes"
              >
                <FileText className="h-4 w-4" />
              </button>
            )}

            {/* Hide/Show Button */}
            <button
              onClick={handleToggleHidden}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Hide task"
            >
              <EyeOff className="h-4 w-4" />
            </button>

            {/* External Link */}
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">

          {/* Notes Section - only show if there are notes or we're adding */}
          {(notes || isAddingNotes) && (
            <div>
              <textarea
                ref={notesRef}
                value={notes}
                onChange={handleNotesChange}
                className="w-full p-2 text-sm resize-none border-none bg-transparent focus:outline-none focus:ring-0 placeholder-gray-400"
                placeholder="Add your notes here..."
                style={{ minHeight: '1.5rem', height: 'auto' }}
                onBlur={() => {
                  if (!notes.trim()) {
                    setIsAddingNotes(false)
                  }
                }}
              />
            </div>
          )}

          {/* Child Tasks */}
          {task.childTasks && task.childTasks.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={handleToggleChildTasks}
                className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors"
              >
                {task.childTasksExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Child Tasks ({task.childTasks.length})
              </button>
              {task.childTasksExpanded && (
                <div className="space-y-1">
                  {task.childTasks.map((childTask) => (
                    <JiraTaskCard key={childTask.id} task={childTask} onUpdateMetadata={onUpdateMetadata} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Local Branches */}
          {task.localBranches && task.localBranches.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={handleToggleLocalBranches}
                className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors"
              >
                {task.localBranchesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Local Branches ({task.localBranches.length})
              </button>
              
              {task.localBranchesExpanded && (
                <LocalBranches branches={task.localBranches} taskKey={task.key} taskStatus={task.status} />
              )}
            </div>
          )}

          {task.pullRequests.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={handleTogglePullRequests}
                className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors"
              >
                {task.pullRequestsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Pull Requests ({task.pullRequests.length})
              </button>
              
              {task.pullRequestsExpanded && (
                <div className="space-y-2">
                  {getPRsSortedByVisibility().map((pr) => (
                    <PullRequestCard key={pr.id} pr={pr} onUpdateMetadata={updatePRMetadata} taskStatus={task.status} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

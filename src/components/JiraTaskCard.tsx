import { TaskWithPRs } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PullRequestCard } from "@/components/PullRequestCard"
import { LocalBranches } from "@/components/LocalBranches"
import { CreateBranchSection } from "@/components/CreateBranchSection"
import { JiraIssueTypeIcon } from "@/components/JiraIssueTypeIcon"
import { JiraPriorityIcon } from "@/components/JiraPriorityIcon"
import { Clock, Eye, EyeOff, X, FileText, GripVertical, ChevronDown, ChevronRight, Pause, Play } from "lucide-react"
import { DualCopyButton } from "@/components/ui/dual-copy-button"
import { useState, useRef, useEffect } from "react"
import { setTaskNotes, setTaskParent, wouldCreateLoop, hideTask, hideTaskUntilUpdated, showTask } from "@/lib/jiraMetadataService"
import { usePRMetadata } from "@/hooks/usePRMetadata"
import { useBulkGitStatus } from "@/hooks/useBulkGitStatus"
import { formatTimeSince } from "@/lib/utils"

interface JiraTaskCardProps {
  task: TaskWithPRs
  onUpdateMetadata: (taskId: string, updates: Partial<{ parentTaskId?: string; notes?: string; hiddenStatus?: 'visible' | 'hidden' | 'hiddenUntilUpdated'; hiddenUntilUpdatedDate?: string; childTasksExpanded?: boolean; pullRequestsExpanded?: boolean; localBranchesExpanded?: boolean }>) => void
  showHiddenItems?: boolean
}

export function JiraTaskCard({ task, onUpdateMetadata, showHiddenItems = false }: JiraTaskCardProps) {
  const [notes, setNotes] = useState(task.notes || '')
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isAddingNotes, setIsAddingNotes] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  
  // PR metadata hook
  const { updatePRMetadata, getPRsSortedByVisibility } = usePRMetadata(task.pullRequests)


  const handleHideTask = () => {
    hideTask(task.id)
    onUpdateMetadata(task.id, { 
      hiddenStatus: 'hidden',
      hiddenUntilUpdatedDate: undefined
    })
  }

  const handleHideUntilUpdated = () => {
    const hiddenDate = new Date().toISOString()
    hideTaskUntilUpdated(task.id)
    onUpdateMetadata(task.id, { 
      hiddenStatus: 'hiddenUntilUpdated',
      hiddenUntilUpdatedDate: hiddenDate
    })
  }

  const handleShowTask = () => {
    showTask(task.id)
    onUpdateMetadata(task.id, { 
      hiddenStatus: 'visible',
      hiddenUntilUpdatedDate: undefined
    })
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
  if (task.hiddenStatus !== 'visible') {
    // Determine which icon to show based on hidden status
    const getHiddenIcon = () => {
      if (task.hiddenStatus === 'hiddenUntilUpdated') {
        return <Play className="h-4 w-4" />
      } else {
        return <Eye className="h-4 w-4" />
      }
    }
    
    const getHiddenTooltip = () => {
      if (task.hiddenStatus === 'hiddenUntilUpdated') {
        return "Show task (hidden until updated)"
      } else {
        return "Show task"
      }
    }

    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border text-sm">
        <button
          onClick={handleShowTask}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          title={getHiddenTooltip()}
        >
          {getHiddenIcon()}
        </button>
        <JiraIssueTypeIcon 
          issueType={task.issueType} 
          iconUrl={task.issueTypeIconUrl}
          className="h-4 w-4"
          size={16}
        />
        <a 
          href={task.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-gray-600 hover:text-blue-600 hover:underline transition-colors"
          title="Open in Jira"
        >
          {task.key}
        </a>
        <DualCopyButton
          identifier={task.key}
          url={task.url}
          identifierTooltip="Copy task key"
          urlTooltip="Copy Jira URL"
        />
        <span className="text-gray-800 truncate">{task.name}</span>
        <Badge className={getStatusColor(task.status)}>
          {task.status}
        </Badge>
        {task.priority !== 'Medium' && task.priority !== 'Normal' && (
          <JiraPriorityIcon 
            priority={task.priority} 
            iconUrl={task.priorityIconUrl}
            className="h-4 w-4"
            size={16}
          />
        )}
        {task.lastJiraUpdate && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            <span title={`Last updated: ${new Date(task.lastJiraUpdate).toLocaleString()}`}>
              {formatTimeSince(task.lastJiraUpdate)} ago
            </span>
          </div>
        )}
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
              <JiraIssueTypeIcon 
                issueType={task.issueType} 
                iconUrl={task.issueTypeIconUrl}
                className="h-4 w-4"
                size={16}
              />
              <a 
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-gray-600 hover:text-blue-600 hover:underline transition-colors"
                title="Open in Jira"
              >
                {task.key}
              </a>
              <DualCopyButton
                identifier={task.key}
                url={task.url}
                identifierTooltip="Copy task key"
                urlTooltip="Copy Jira URL"
              />
              
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
              {task.priority !== 'Medium' && task.priority !== 'Normal' && (
                <JiraPriorityIcon 
                  priority={task.priority} 
                  iconUrl={task.priorityIconUrl}
                  className="h-4 w-4"
                  size={16}
                />
              )}
              {!task.isInSprint && (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Not in Sprint
                </Badge>
              )}
              
              {task.lastJiraUpdate && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span title={`Last updated: ${new Date(task.lastJiraUpdate).toLocaleString()}`}>
                    {formatTimeSince(task.lastJiraUpdate)} ago
                  </span>
                </div>
              )}
            </div>
            
            <CardTitle className="text-lg font-semibold mb-3">
              {task.name}
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-2">            
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

            {/* Hide/Show Buttons */}
            {task.hiddenStatus === 'visible' ? (
              <>
                <button
                  onClick={handleHideTask}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  title="Hide task permanently"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
                <button
                  onClick={handleHideUntilUpdated}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  title="Hide until updated"
                >
                  <Pause className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleShowTask}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Show task"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}

            {/* Drag Handle */}
            <div
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
              draggable
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              title="Drag to set parent"
            >
              <GripVertical className="h-4 w-4" />
            </div>
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
          {task.childTasks && task.childTasks.length > 0 && (() => {
            const visibleChildTasks = showHiddenItems 
              ? task.childTasks 
              : task.childTasks.filter(childTask => childTask.hiddenStatus === 'visible');
            
            return visibleChildTasks.length > 0 && (
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
                  Child Tasks ({visibleChildTasks.length}{!showHiddenItems && task.childTasks.length > visibleChildTasks.length ? ` of ${task.childTasks.length}` : ''})
                </button>
                {task.childTasksExpanded && (
                  <div className="space-y-1">
                    {visibleChildTasks.map((childTask) => (
                      <JiraTaskCard 
                        key={childTask.id} 
                        task={childTask} 
                        onUpdateMetadata={onUpdateMetadata}
                        showHiddenItems={showHiddenItems}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

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

          {task.pullRequests.length > 0 && (() => {
            const allPRs = getPRsSortedByVisibility();
            const visiblePRs = showHiddenItems 
              ? allPRs 
              : allPRs.filter(pr => !pr.hidden);
            
            return visiblePRs.length > 0 && (
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
                  Pull Requests ({visiblePRs.length}{!showHiddenItems && allPRs.length > visiblePRs.length ? ` of ${allPRs.length}` : ''})
                </button>
                
                {task.pullRequestsExpanded && (
                  <div className="space-y-2">
                    {visiblePRs.map((pr) => (
                      <PullRequestCard key={pr.id} pr={pr} onUpdateMetadata={updatePRMetadata} taskStatus={task.status} />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Create New Branch - only show if no local branches and no PRs */}
          {(!task.localBranches || task.localBranches.length === 0) && task.pullRequests.length === 0 && (
            <div className="space-y-2">
              <CreateBranchSection 
                taskKey={task.key}
                taskName={task.name}
                issueType={task.issueType}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

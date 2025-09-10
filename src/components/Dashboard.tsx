"use client";

import { useState, useEffect } from "react";
import { JiraTaskCard } from "@/components/JiraTaskCard";
import { ReviewInbox } from "@/components/ReviewInbox";
import { PersonalNotes } from "@/components/PersonalNotes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";


import { TaskWithPRs, GitHubPR } from "@/types";
import { useReviewInbox } from "@/hooks/useReviewInbox";
import { useJiraPolling } from "@/hooks/useJiraPolling";
import {
  Users,
  Loader2,
  Filter,
  RefreshCw,
  AlertTriangle,
  Clock,
  Search,
} from "lucide-react";
import { useJiraMetadata } from "@/hooks/useJiraMetadata";

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [loadingLocalBranches, setLoadingLocalBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [githubRateLimit, setGithubRateLimit] = useState<{
    remaining: number;
    limit: number;
    resetTime: Date | null;
    isRateLimited: boolean;
  } | null>(null);

  // Use the review inbox hook for real-time updates
  const {
    prs: reviewPRs,
    hasNewPRs,
    lastUpdateTime,
    refresh: refreshReviewPRs
  } = useReviewInbox();

  // Use the JIRA polling hook for background updates
  const {
    tasks,
    setTasks,
    jiraHasChanges,
    setJiraHasChanges,
    lastJiraCheck,
    setLastJiraCheck
  } = useJiraPolling([], loading);

  // Use the metadata hook
  const { updateMetadata, getRootTasksWithMetadata } = useJiraMetadata(tasks);


  // Function to update task metadata
  const updateTaskMetadata = (taskId: string, updates: Partial<{ parentTaskId?: string; notes?: string; hidden: boolean; childTasksExpanded?: boolean; pullRequestsExpanded?: boolean; localBranchesExpanded?: boolean }>) => {
    updateMetadata(taskId, updates);
  };



  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        console.log('Phase 1: Loading JIRA tasks + PRs...');
        const response = await fetch("/api/dashboard");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        const fetchedTasks = data.tasks || [];
        setTasks(fetchedTasks);
        setLoading(false);

        // Set rate limit status from API response (after all API calls)
        if (data.rateLimit) {
          setGithubRateLimit({
            ...data.rateLimit,
            resetTime: data.rateLimit.resetTime ? new Date(data.rateLimit.resetTime) : null
          });
        }

        console.log('Phase 1 complete! Starting Phase 2: Loading local branches...');
        
        // Phase 2: Load local branches in background
        loadLocalBranches(fetchedTasks);

        // Debug: Log all unique status names to see what's actually coming from JIRA
        const actualStatuses = [
          ...new Set(fetchedTasks.map((task: TaskWithPRs) => task.status)),
        ] as string[];
        console.log("Actual JIRA statuses found:", actualStatuses);
        console.log(
          "Tasks with their statuses:",
          fetchedTasks.map((task: TaskWithPRs) => ({
            key: task.key,
            status: task.status,
          }))
        );
        console.log("Issue types found:", [...new Set(fetchedTasks.map((task: TaskWithPRs) => task.issueType))]);

        // Debug: Log task descriptions
        console.log(
          "Task descriptions debug:",
          fetchedTasks.map((task: TaskWithPRs) => ({
            key: task.key,
            description: task.description,
            descriptionLength: task.description?.length || 0,
            hasDescription: !!task.description,
            repository: task.pullRequests?.[0]?.repository || "No PRs",
          }))
        );
      } catch (err) {
        setError("Failed to load tasks");
        console.error("Error loading dashboard data:", err);
        setLoading(false);
      }
    }

    async function loadLocalBranches(tasks: TaskWithPRs[]) {
      try {
        setLoadingLocalBranches(true);
        console.log('Phase 2: Loading local branches...', tasks.length, 'tasks');
        
        console.log('Phase 2: Making POST request with', tasks.length, 'tasks');
        
        const response = await fetch('/api/dashboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'local-branches',
            tasks: tasks
          })
        });
        
        console.log('Phase 2: Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Phase 2: Response data:', data);

        if (data.error) {
          throw new Error(data.error);
        }

        const tasksWithBranches = data.tasks || [];
        console.log('Phase 2: Setting tasks with branches:', tasksWithBranches.length);
        setTasks(tasksWithBranches);
        console.log('Phase 2 complete! Local branches loaded.');
      } catch (err) {
        console.error("Error loading local branches:", err);
        // Continue without local branches - tasks are already loaded
      } finally {
        setLoadingLocalBranches(false);
      }
    }

    loadData();
  }, []);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Clear cache by adding a timestamp parameter
      const response = await fetch(`/api/dashboard?refresh=${Date.now()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setTasks(data.tasks || []);
      setJiraHasChanges(false); // Clear change indicator

      // Set rate limit status from API response (after all API calls)
      if (data.rateLimit) {
        setGithubRateLimit({
          ...data.rateLimit,
          resetTime: data.rateLimit.resetTime ? new Date(data.rateLimit.resetTime) : null
        });
      }
    } catch (err) {
      setError("Failed to refresh data");
      console.error("Error refreshing dashboard data:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // Search function that searches across all task properties
  const searchTasks = (tasks: TaskWithPRs[], searchText: string): TaskWithPRs[] => {
    if (!searchText.trim()) return tasks;
    
    const searchLower = searchText.toLowerCase();
    
    return tasks.filter((task) => {
      // Search in basic task properties
      const basicMatch = 
        task.key.toLowerCase().includes(searchLower) ||
        task.name.toLowerCase().includes(searchLower) ||
        task.status.toLowerCase().includes(searchLower) ||
        task.issueType.toLowerCase().includes(searchLower) ||
        task.assignee.toLowerCase().includes(searchLower) ||
        task.priority.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower));
      
      // Search in pull request properties
      const prMatch = task.pullRequests.some((pr) =>
        pr.title.toLowerCase().includes(searchLower) ||
        pr.author.toLowerCase().includes(searchLower) ||
        pr.branch.toLowerCase().includes(searchLower) ||
        (pr.repository && pr.repository.toLowerCase().includes(searchLower)) ||
        pr.reviewStatus.toLowerCase().includes(searchLower) ||
        pr.requestedReviewers.some(reviewer => reviewer.toLowerCase().includes(searchLower)) ||
        pr.approvedReviewers.some(reviewer => reviewer.toLowerCase().includes(searchLower))
      );
      
      return basicMatch || prMatch;
    });
  };

  // Get root tasks with metadata applied and filter
  const rootTasksWithMetadata = getRootTasksWithMetadata();
  const filteredTasks = searchTasks(rootTasksWithMetadata, searchText);

  const totalPRs = tasks.reduce(
    (sum, task) => sum + task.pullRequests.length,
    0
  );



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-600" />
          <p className="text-gray-600">Loading your work dashboard...</p>
        </div>
      </div>
    );
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
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Work Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* GitHub Rate Limit Indicator */}
              {githubRateLimit && (
                <div className="flex items-center gap-2">
                  {githubRateLimit.isRateLimited ? (
                    <Badge
                      variant="destructive"
                      className="flex items-center gap-1"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      GitHub Rate Limited
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Clock className="h-3 w-3" />
                      GitHub: {githubRateLimit.remaining}/
                      {githubRateLimit.limit}
                    </Badge>
                  )}
                  {githubRateLimit.resetTime && (
                    <span className="text-xs text-gray-500">
                      Resets: {githubRateLimit.resetTime.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>{tasks.length} Tasks</span>
                {loadingLocalBranches && (
                  <div className="flex items-center gap-1 text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Loading local branches...</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className={`flex items-center gap-2 ${jiraHasChanges ? "border-orange-500 bg-orange-50" : ""}`}
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh {jiraHasChanges && "• Updated"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks, PRs, assignees, repositories, etc..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {searchText && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchText("")}
                className="flex items-center gap-2"
              >
                Clear
              </Button>
            )}
          </div>
          {searchText && (
            <div className="mt-2 text-sm text-gray-600">
              Showing {filteredTasks.length} of {tasks.length} tasks
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         {/* Personal Notes & Todos */}
         <PersonalNotes />

         {/* Review Inbox */}
         <ReviewInbox 
           prs={reviewPRs} 
           isLoading={false}
           hasNewPRs={hasNewPRs}
           lastUpdateTime={lastUpdateTime}
         />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Filtered Tasks
            </h2>
            <Badge variant="secondary">{filteredTasks.length} tasks</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Total PRs: {totalPRs}</span>
          </div>
        </div>

        {/* Tasks Grid */}
        {filteredTasks.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {filteredTasks.map((task) => (
              <JiraTaskCard key={task.id} task={task} onUpdateMetadata={updateTaskMetadata} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No tasks found</p>
              <p className="text-sm">
                {searchText ? "Try adjusting your search terms" : "No tasks available"}
              </p>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

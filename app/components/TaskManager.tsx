import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, CheckCircle, AlertCircle, Clock } from "lucide-react";

// Task status type
export type TaskStatus = "pending" | "processing" | "completed" | "failed";

// Task type
export interface Task {
  id: string;
  status: TaskStatus;
  progress: number;
  totalItems: number;
  completedItems: number;
  createdAt: string;
  updatedAt: string;
  result?: {
    variants_generated?: number;
    successful?: number;
    failed?: number;
    keywords?: Array<{
      keyword: string;
      status: string;
      variants_count?: number;
      error?: string;
    }>;
  };
  error?: string;
  message?: string;
}

interface TaskManagerProps {
  tasks: Task[];
  onRemoveTask: (taskId: string) => void;
  onRefreshList?: () => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({
  tasks,
  onRemoveTask,
  onRefreshList,
}) => {
  // Return early if no tasks
  if (!tasks || tasks.length === 0) {
    return null;
  }

  // Status badge
  const StatusBadge = ({ status }: { status: TaskStatus }) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-amber-100 dark:bg-amber-900 dark:text-amber-100 text-amber-900"
          >
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge
            variant="outline"
            className="bg-blue-100 dark:bg-blue-900 dark:text-blue-100 text-blue-900"
          >
            <span className="w-3 h-3 mr-1 rounded-full bg-blue-500 animate-pulse"></span>
            Processing
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="bg-green-100 dark:bg-green-900 dark:text-green-100 text-green-900"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="outline"
            className="bg-red-100 dark:bg-red-900 dark:text-red-100 text-red-900"
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  // Format time since task creation
  const formatTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Active Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="border rounded-md p-4 relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={() => onRemoveTask(task.id)}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={task.status} />
                <span className="text-sm text-muted-foreground">
                  {formatTimeSince(task.createdAt)}
                </span>
              </div>

              <div className="mb-2">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">
                    {task.status === "completed"
                      ? `Completed: ${task.completedItems}/${task.totalItems}`
                      : `Processing ${task.totalItems} items`}
                  </span>
                  <span className="text-sm font-medium">{task.progress}%</span>
                </div>
                <Progress value={task.progress} className="h-2" />
              </div>

              {task.error && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded">
                  Error: {task.error}
                </div>
              )}

              {task.result && (
                <div className="mt-2 text-sm">
                  <p>
                    Generated {task.result.variants_generated ?? 0} variants for{" "}
                    {task.result.successful ?? 0} keywords.
                  </p>
                  {(task.result.failed ?? 0) > 0 && (
                    <p className="text-amber-700 dark:text-amber-400">
                      {task.result.failed} keywords failed.
                    </p>
                  )}
                </div>
              )}

              {task.status === "completed" && onRefreshList && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={onRefreshList}
                >
                  Refresh List
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskManager;

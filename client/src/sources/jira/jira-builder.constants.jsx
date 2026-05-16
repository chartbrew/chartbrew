import {
  LuActivity,
  LuBug,
  LuCalendarDays,
  LuChartBar,
  LuClipboardList,
  LuColumns3,
  LuFlag,
  LuListChecks,
  LuTable,
} from "react-icons/lu";

export const DATE_VARIABLES = {
  startDate: "start_date",
  endDate: "end_date",
};

export const RESOURCE_OPTIONS = [{
  id: "issues",
  label: "Issues",
  description: "Issue lists, trends, and breakdowns",
  icon: LuClipboardList,
  iconClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
}, {
  id: "sprint_issues",
  label: "Sprint issues",
  description: "Sprint completion, carryover, and workload",
  icon: LuListChecks,
  iconClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
}, {
  id: "boards",
  label: "Boards",
  description: "Available Jira Agile boards",
  icon: LuColumns3,
  iconClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
}, {
  id: "sprints",
  label: "Sprints",
  description: "Sprints for a selected board",
  icon: LuCalendarDays,
  iconClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
}, {
  id: "versions",
  label: "Versions",
  description: "Project releases and fix versions",
  icon: LuFlag,
  iconClassName: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
}];

export const MODE_OPTIONS = [
  { id: "visual", label: "Visual" },
  { id: "jql", label: "JQL" },
  { id: "advanced", label: "Advanced" },
];

export const BOARD_TYPE_OPTIONS = [
  { value: "", label: "Any board type" },
  { value: "scrum", label: "Scrum" },
  { value: "kanban", label: "Kanban" },
  { value: "simple", label: "Simple" },
];

export const SPRINT_STATE_OPTIONS = [
  { value: "", label: "All states" },
  { value: "active", label: "Active" },
  { value: "future", label: "Future" },
  { value: "closed", label: "Closed" },
];

export const GROUP_BY_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "statusCategory", label: "Status category" },
  { value: "assignee", label: "Assignee" },
  { value: "priority", label: "Priority" },
  { value: "issueType", label: "Issue type" },
  { value: "projectKey", label: "Project" },
];

export const METRIC_OPTIONS = [
  { value: "count", label: "Count issues" },
  { value: "storyPoints", label: "Sum story points" },
  { value: "averageAge", label: "Average age" },
  { value: "leadTime", label: "Lead time" },
];

export const DATE_FIELD_OPTIONS = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "resolved", label: "Resolved" },
  { value: "doneAt", label: "Done date" },
];

export const TRANSFORM_OPTIONS = [
  { value: "raw", label: "Raw table", icon: LuTable },
  { value: "grouped", label: "Grouped breakdown", icon: LuChartBar },
  { value: "created_resolved_trend", label: "Created vs resolved", icon: LuActivity },
  { value: "sprint_summary", label: "Sprint summary", icon: LuListChecks },
  { value: "stale_table", label: "Stale issue table", icon: LuBug },
];

export const RESOURCE_TRANSFORM_OPTIONS = {
  issues: TRANSFORM_OPTIONS.filter((option) => option.value !== "sprint_summary"),
  sprint_issues: TRANSFORM_OPTIONS.filter((option) => option.value !== "created_resolved_trend"),
  boards: TRANSFORM_OPTIONS.filter((option) => option.value === "raw"),
  sprints: TRANSFORM_OPTIONS.filter((option) => option.value === "raw"),
  versions: TRANSFORM_OPTIONS.filter((option) => option.value === "raw"),
};

export const PREVIEW_ROW_LIMIT = 25;

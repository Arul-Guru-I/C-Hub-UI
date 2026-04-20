// ===== Navigation =====
export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

// ===== User =====
export interface User {
  id: string;
  name: string;
  avatar: string;
  role: string;
  email: string;
}

// ===== Task =====
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: User;
  dueDate: string;
  tags: string[];
  createdAt: string;
}

// ===== Test =====
export type TestStatus = 'passed' | 'failed' | 'pending' | 'skipped';

export interface TestCase {
  id: string;
  name: string;
  suite: string;
  status: TestStatus;
  duration: number; // ms
  lastRun: string;
  coveredLines: number;
  totalLines: number;
}

export interface TestSuite {
  id: string;
  name: string;
  tests: TestCase[];
  passRate: number;
  lastRun: string;
}

// ===== Review =====
export type ReviewStatus = 'open' | 'approved' | 'changes-requested' | 'merged';

export interface Review {
  id: string;
  title: string;
  author: User;
  reviewers: User[];
  status: ReviewStatus;
  branch: string;
  baseBranch: string;
  changedFiles: number;
  additions: number;
  deletions: number;
  comments: number;
  createdAt: string;
  labels: string[];
}

// ===== Forum =====
export type ForumCategory = 'general' | 'help' | 'announcements' | 'showcase' | 'feedback';

export interface ForumThread {
  id: string;
  title: string;
  author: User;
  category: ForumCategory;
  tags: string[];
  upvotes: number;
  replies: number;
  views: number;
  isPinned: boolean;
  isSolved: boolean;
  createdAt: string;
  lastReply: string;
}

// ===== Stats =====
export interface StatCard {
  label: string;
  value: string | number;
  change: number;
  icon: string;
  color: string;
}

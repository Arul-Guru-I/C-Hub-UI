import type { Task, TestSuite, Review, ForumThread, User } from '../types';

export const mockUsers: User[] = [
  { id: '1', name: 'Arul Guru', avatar: 'AG', role: 'Lead Dev', email: 'arul@chub.dev' },
  { id: '2', name: 'Maya Patel', avatar: 'MP', role: 'Backend Dev', email: 'maya@chub.dev' },
  { id: '3', name: 'Sam Chen', avatar: 'SC', role: 'Frontend Dev', email: 'sam@chub.dev' },
  { id: '4', name: 'Ria Nair', avatar: 'RN', role: 'QA Engineer', email: 'ria@chub.dev' },
];

export const mockTasks: Task[] = [
  {
    id: 't1', title: 'Implement authentication flow', description: 'Set up JWT-based login and refresh token mechanism.',
    status: 'in-progress', priority: 'critical', assignee: mockUsers[0], dueDate: '2026-03-28',
    tags: ['auth', 'backend'], createdAt: '2026-03-20',
  },
  {
    id: 't2', title: 'Design onboarding screens', description: 'Create figma mockups for the user onboarding experience.',
    status: 'todo', priority: 'high', assignee: mockUsers[2], dueDate: '2026-03-30',
    tags: ['design', 'ux'], createdAt: '2026-03-21',
  },
  {
    id: 't3', title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment.',
    status: 'done', priority: 'high', assignee: mockUsers[1], dueDate: '2026-03-22',
    tags: ['devops', 'ci-cd'], createdAt: '2026-03-15',
  },
  {
    id: 't4', title: 'API rate limiting middleware', description: 'Add request throttling to protect the public API endpoints.',
    status: 'todo', priority: 'medium', assignee: mockUsers[1], dueDate: '2026-04-03',
    tags: ['api', 'security'], createdAt: '2026-03-22',
  },
  {
    id: 't5', title: 'Write unit tests for utils', description: 'Achieve 90% coverage on the shared utilities module.',
    status: 'in-progress', priority: 'medium', assignee: mockUsers[3], dueDate: '2026-03-31',
    tags: ['testing'], createdAt: '2026-03-18',
  },
  {
    id: 't6', title: 'Database query optimization', description: 'Investigate and fix N+1 queries on the dashboard endpoint.',
    status: 'todo', priority: 'low', assignee: mockUsers[0], dueDate: '2026-04-07',
    tags: ['database', 'performance'], createdAt: '2026-03-23',
  },
];

export const mockTestSuites: TestSuite[] = [
  {
    id: 's1', name: 'Auth Module', passRate: 94, lastRun: '2026-03-24T02:00:00Z',
    tests: [
      { id: 'tc1', name: 'login with valid credentials', suite: 'Auth Module', status: 'passed', duration: 42, lastRun: '2026-03-24T02:00:00Z', coveredLines: 128, totalLines: 135 },
      { id: 'tc2', name: 'reject invalid password', suite: 'Auth Module', status: 'passed', duration: 38, lastRun: '2026-03-24T02:00:00Z', coveredLines: 60, totalLines: 62 },
      { id: 'tc3', name: 'refresh token rotation', suite: 'Auth Module', status: 'failed', duration: 120, lastRun: '2026-03-24T02:00:00Z', coveredLines: 45, totalLines: 80 },
    ],
  },
  {
    id: 's2', name: 'Task API', passRate: 100, lastRun: '2026-03-24T01:30:00Z',
    tests: [
      { id: 'tc4', name: 'create task returns 201', suite: 'Task API', status: 'passed', duration: 55, lastRun: '2026-03-24T01:30:00Z', coveredLines: 90, totalLines: 90 },
      { id: 'tc5', name: 'list tasks with filters', suite: 'Task API', status: 'passed', duration: 70, lastRun: '2026-03-24T01:30:00Z', coveredLines: 110, totalLines: 115 },
    ],
  },
  {
    id: 's3', name: 'Forum Service', passRate: 75, lastRun: '2026-03-23T22:00:00Z',
    tests: [
      { id: 'tc6', name: 'create thread success', suite: 'Forum Service', status: 'passed', duration: 33, lastRun: '2026-03-23T22:00:00Z', coveredLines: 40, totalLines: 42 },
      { id: 'tc7', name: 'upvote thread idempotency', suite: 'Forum Service', status: 'failed', duration: 88, lastRun: '2026-03-23T22:00:00Z', coveredLines: 20, totalLines: 45 },
      { id: 'tc8', name: 'reply nested threads', suite: 'Forum Service', status: 'skipped', duration: 0, lastRun: '2026-03-23T22:00:00Z', coveredLines: 0, totalLines: 30 },
      { id: 'tc9', name: 'search by category', suite: 'Forum Service', status: 'passed', duration: 61, lastRun: '2026-03-23T22:00:00Z', coveredLines: 55, totalLines: 58 },
    ],
  },
];

export const mockReviews: Review[] = [
  {
    id: 'r1', title: 'feat: add JWT refresh token rotation', author: mockUsers[0],
    reviewers: [mockUsers[1], mockUsers[2]], status: 'open', branch: 'feature/auth-refresh',
    baseBranch: 'main', changedFiles: 8, additions: 234, deletions: 45,
    comments: 3, createdAt: '2026-03-23', labels: ['feature', 'auth'],
  },
  {
    id: 'r2', title: 'fix: resolve N+1 query on dashboard', author: mockUsers[1],
    reviewers: [mockUsers[0]], status: 'changes-requested', branch: 'fix/dashboard-n-plus-1',
    baseBranch: 'main', changedFiles: 3, additions: 67, deletions: 120,
    comments: 8, createdAt: '2026-03-22', labels: ['bug', 'performance'],
  },
  {
    id: 'r3', title: 'chore: upgrade all dependencies to latest', author: mockUsers[2],
    reviewers: [mockUsers[0], mockUsers[3]], status: 'approved', branch: 'chore/dep-upgrade',
    baseBranch: 'main', changedFiles: 2, additions: 15, deletions: 15,
    comments: 1, createdAt: '2026-03-21', labels: ['chore'],
  },
  {
    id: 'r4', title: 'feat: forum thread pinning and categories', author: mockUsers[3],
    reviewers: [mockUsers[1]], status: 'merged', branch: 'feature/forum-categories',
    baseBranch: 'main', changedFiles: 14, additions: 680, deletions: 22,
    comments: 12, createdAt: '2026-03-19', labels: ['feature', 'forum'],
  },
];

export const mockThreads: ForumThread[] = [
  {
    id: 'f1', title: 'How do I configure the API rate limiter for dev environments?',
    author: mockUsers[2], category: 'help', tags: ['api', 'config'],
    upvotes: 14, replies: 7, views: 203, isPinned: false, isSolved: true,
    createdAt: '2026-03-23', lastReply: '2026-03-24',
  },
  {
    id: 'f2', title: 'CHub v2.0 is here',
    author: mockUsers[0], category: 'announcements', tags: ['release', 'v2'],
    upvotes: 88, replies: 24, views: 1420, isPinned: true, isSolved: false,
    createdAt: '2026-03-20', lastReply: '2026-03-24',
  },
  {
    id: 'f3', title: 'Showcase: Built a CLI tool using CHub APIs',
    author: mockUsers[3], category: 'showcase', tags: ['cli', 'community'],
    upvotes: 32, replies: 11, views: 540, isPinned: false, isSolved: false,
    createdAt: '2026-03-18', lastReply: '2026-03-23',
  },
  {
    id: 'f4', title: 'Best practices for organizing large monorepos?',
    author: mockUsers[1], category: 'general', tags: ['monorepo', 'architecture'],
    upvotes: 19, replies: 15, views: 388, isPinned: false, isSolved: false,
    createdAt: '2026-03-17', lastReply: '2026-03-22',
  },
  {
    id: 'f5', title: 'Feedback: Task assignment UX feels clunky on mobile',
    author: mockUsers[2], category: 'feedback', tags: ['ux', 'mobile'],
    upvotes: 9, replies: 4, views: 97, isPinned: false, isSolved: false,
    createdAt: '2026-03-22', lastReply: '2026-03-23',
  },
];

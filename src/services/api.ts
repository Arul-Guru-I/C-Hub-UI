import axios from 'axios';

// Use direct backend URL instead of Vite proxy (Ensure CORS is enabled on FastAPI)
const API_URL = 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptors for Auth Token and Logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data ?? '');
    // Assumes the token is stored in localStorage
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error(`[API Request Error]`, error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`, response.data);
    return response;
  },
  (error) => {
    console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} - Status: ${error.response?.status}`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// --- Types ---

export interface UserCreate {
  name: string;
  email: string;
  role?: string;
  github_username?: string;
  password?: string;
  cohort?: string | null;
}

export interface UserInDB {
  name: string;
  email: string;
  role?: string;
  github_username?: string;
  _id?: string;
  hashed_password?: string;
  cohort?: string | null;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  role?: string;
  cohort?: string | null;
}

export interface PerformanceLog {
  _id?: string;
  user_id: string;
  pr_number?: number;
  score: number;
  rubric?: Record<string, any>;
  created_at?: string;
}

export interface Post {
  title: string;
  content: string;
  _id?: string;
  author_id: string;
  author_name: string;
  created_at?: string;
  replies?: Reply[];
  cohort?: string | null;
  author_cohort?: string | null;
}

export interface PostCreate {
  title: string;
  content: string;
  cohort?: string | null;
}

export interface Reply {
  content: string;
  _id: string;
  author_id: string;
  author_name: string;
  created_at?: string;
}

export interface ReplyCreate {
  content: string;
}

export interface Feedback {
  user_id: string;
  pr_number: number;
  content: string;
  _id?: string;
  reviewer_id: string;
  reviewer_name: string;
  created_at?: string;
  score?: number | null;
  summary?: string;
}

export interface FeedbackCreate {
  user_id: string;
  pr_number: number;
  content: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// --- API Functions ---

export const authApi = {
  loginForAccessToken: async (data: Record<string, string>) => {
    const params = new URLSearchParams();
    if (data.username) params.append('username', data.username);
    if (data.password) params.append('password', data.password);

    const response = await apiClient.post<TokenResponse>('/auth/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },
};

export const usersApi = {
  createUser: async (user: UserCreate) => {
    const response = await apiClient.post<UserInDB>('/users/', user);
    return response.data;
  },
  listUsers: async (skip: number = 0, limit: number = 10, cohort?: string) => {
    const params: Record<string, any> = { skip, limit };
    if (cohort) params.cohort = cohort;
    const response = await apiClient.get<UserInDB[]>('/users/', { params });
    return response.data;
  },
  getAvailableCohorts: async () => {
    const response = await apiClient.get<string[]>('/users/cohorts/available');
    return response.data;
  },
  getMe: async () => {
    const response = await apiClient.get<UserInDB>('/users/me');
    return response.data;
  },
  getUser: async (userId: string) => {
    const response = await apiClient.get<UserInDB>(`/users/${userId}`);
    return response.data;
  },
  updateUser: async (userId: string, user: UserUpdate) => {
    const response = await apiClient.patch<UserInDB>(`/users/${userId}`, user);
    return response.data;
  },
  deleteUser: async (userId: string) => {
    await apiClient.delete(`/users/${userId}`);
  },
};

export const performanceApi = {
  getPerformance: async (userId: string) => {
    const response = await apiClient.get<PerformanceLog[]>(`/performance/${userId}`);
    return response.data;
  },
  getCohortPerformance: async (slug: string) => {
    const response = await apiClient.get<PerformanceLog[]>(`/performance/cohort/${slug}`);
    return response.data;
  },
};

export const forumApi = {
  listPosts: async (skip: number = 0, limit: number = 20, cohort?: string) => {
    const params: Record<string, any> = { skip, limit };
    if (cohort) params.cohort = cohort;
    const response = await apiClient.get<Post[]>('/forum/', { params });
    return response.data;
  },
  createPost: async (post: PostCreate) => {
    const response = await apiClient.post<Post>('/forum/', post);
    return response.data;
  },
  addReply: async (postId: string, reply: ReplyCreate) => {
    const response = await apiClient.post<Post>(`/forum/${postId}/reply`, reply);
    return response.data;
  },
};

export interface CombinedPerformanceEntry {
  score: number;
  pr_author_name?: string;
  pr_author_github?: string;
  pr_number?: number;
  created_at?: string;
  [key: string]: any;
}

export interface CombinedFeedbackEntry {
  content: string;
  summary?: string;
  score?: number | null;
  pr_author_name?: string;
  pr_author_github?: string;
  pr_number?: number;
  created_at?: string;
  [key: string]: any;
}

export interface CombinedFeedbackResponse {
  performances: CombinedPerformanceEntry[];
  feedbacks: CombinedFeedbackEntry[];
}

export const feedbacksApi = {
  createFeedback: async (feedback: FeedbackCreate) => {
    const response = await apiClient.post<Feedback>('/feedbacks/', feedback);
    return response.data;
  },
  listFeedback: async (userId: string) => {
    const response = await apiClient.get<Feedback[]>(`/feedbacks/${userId}`);
    return response.data;
  },
  getCombinedFeedback: async (userId: string) => {
    const response = await apiClient.get<CombinedFeedbackResponse>(`/feedbacks/combined/${userId}`);
    return response.data;
  },
  getCohortFeedback: async (slug: string) => {
    const response = await apiClient.get<Feedback[]>(`/feedbacks/cohort/${slug}`);
    return response.data;
  },
};

export const systemApi = {
  healthCheck: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

// --- Tests / MCQ Quiz Types ---

export interface TopicsResponse {
  topics: string[];
  difficulties: string[];
}

export interface TestQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface GeneratedTest {
  test_id: string;
  topic: string;
  difficulty: string;
  num_questions: number;
  source: 'bank' | 'rag' | 'llm';
  questions: TestQuestion[];
}

export interface PregenRequest {
  topic: string;
  difficulty?: string;
  pool_size?: number;
}

export interface PregenResponse {
  topic: string;
  difficulty: string;
  pool_size: number;
  message: string;
}

export interface AnswerSubmit {
  question_id: string;
  selected_option: number;
}

export interface QuestionResult {
  question_id: string;
  question?: string;
  selected_option: number;
  correct_option: number;
  correct: boolean;
  explanation: string;
}

export interface TopicPerformance {
  topic: string;
  average_score: number;
  tests_taken: number;
  recent_scores: number[];
}

export interface SubmitTestResponse {
  score: number;
  correct_count: number;
  total: number;
  results: QuestionResult[];
  topic_performance?: TopicPerformance[];
}

export interface TestHistoryEntry {
  _id: string;
  test_id: string;
  user_id: string;
  user_name: string;
  topic: string;
  score: number;
  correct_count: number;
  total: number;
  submitted_at: string;
}

export interface HistoryResponse {
  results: TestHistoryEntry[];
}

export interface IngestRequest {
  topic: string;
  content: string;
  source?: string;
}

export interface IngestResponse {
  topic: string;
  source: string;
  chunks_stored: number;
  message: string;
}

export interface IngestFileRequest {
  topic: string;
  file_path: string;
}

export interface IngestFileResponse {
  topic: string;
  file_path: string;
  chunks_stored: number;
  message: string;
}

export interface CollectionInfo {
  collection: string;
  document_count: number;
}

export interface CollectionsResponse {
  collections: CollectionInfo[];
}

export interface DeleteCollectionResponse {
  deleted: boolean;
  topic: string;
}

// --- Attendance Types ---

export interface AttendanceSessionCreate {
  subject: string;
  date?: string;
  expires_minutes?: number;
  cohort?: string | null;
}

export interface AttendanceSession {
  id: string;
  subject: string;
  date: string;
  token: string;
  created_by: string;
  created_by_name: string;
  expires_at: string;
  active: boolean;
  cohort?: string | null;
}

export interface AttendanceAttendee {
  id: string;
  user_id: string;
  user_name: string;
  checked_in_at: string;
  ip_address: string;
  user_cohort?: string | null;
}

export interface AttendanceSessionDetail extends AttendanceSession {
  total_count: number;
  attendees: AttendanceAttendee[];
}

export interface CreateSessionResponse {
  session: AttendanceSession;
  qr_code_base64: string;
  check_in_url: string;
}

export interface MyQRResponse {
  check_in_url: string;
  qr_code_base64: string;
  user: { id: string; name: string; email: string };
  session: { id: string; subject: string; date: string; expires_at: string };
}

export interface MyAttendanceRecord {
  id: string;
  session_id: string;
  subject: string;
  date: string;
  checked_in_at: string;
  ip_address: string;
  user_cohort?: string | null;
}

export const attendanceApi = {
  createSession: async (data: AttendanceSessionCreate): Promise<CreateSessionResponse> => {
    const response = await apiClient.post<CreateSessionResponse>('/attendance/sessions', data);
    return response.data;
  },
  listSessions: async (skip = 0, limit = 20, cohort?: string): Promise<AttendanceSession[]> => {
    const params: Record<string, any> = { skip, limit };
    if (cohort) params.cohort = cohort;
    const response = await apiClient.get<AttendanceSession[]>('/attendance/sessions', { params });
    return response.data;
  },
  getSession: async (sessionId: string): Promise<AttendanceSessionDetail> => {
    const response = await apiClient.get<AttendanceSessionDetail>(`/attendance/sessions/${sessionId}`);
    return response.data;
  },
  getMyQR: async (sessionId: string): Promise<MyQRResponse> => {
    const response = await apiClient.get<MyQRResponse>(`/attendance/sessions/${sessionId}/my-qr`);
    return response.data;
  },
  getMyAttendance: async (skip = 0, limit = 20): Promise<MyAttendanceRecord[]> => {
    const response = await apiClient.get<MyAttendanceRecord[]>('/attendance/me', { params: { skip, limit } });
    return response.data;
  },
};

export const testsApi = {
  getTopics: async () => {
    const response = await apiClient.get<TopicsResponse>('/tests/topics');
    return response.data;
  },
  generateTest: async (topic: string, difficulty: string, num_questions: number = 5) => {
    const response = await apiClient.post<GeneratedTest>('/tests/generate', { topic, difficulty, num_questions });
    return response.data;
  },
  getTest: async (testId: string) => {
    const response = await apiClient.get<GeneratedTest>(`/tests/${testId}`);
    return response.data;
  },
  submitTest: async (testId: string, answers: AnswerSubmit[]) => {
    const response = await apiClient.post<SubmitTestResponse>(`/tests/${testId}/submit`, { answers });
    return response.data;
  },
  getMyResults: async () => {
    const response = await apiClient.get<HistoryResponse>('/tests/results/me');
    return response.data.results;
  },
  getUserResults: async (userId: string) => {
    const response = await apiClient.get<HistoryResponse>(`/tests/results/${userId}`);
    return response.data.results;
  },
  ingestTopic: async (data: IngestRequest) => {
    const response = await apiClient.post<IngestResponse>('/tests/ingest', data);
    return response.data;
  },
  ingestFile: async (data: IngestFileRequest) => {
    const response = await apiClient.post<IngestFileResponse>('/tests/ingest/file', data);
    return response.data;
  },
  getCollections: async () => {
    const response = await apiClient.get<CollectionsResponse>('/tests/collections');
    return response.data;
  },
  deleteCollection: async (topic: string) => {
    const response = await apiClient.delete<DeleteCollectionResponse>(`/tests/collections/${encodeURIComponent(topic)}`);
    return response.data;
  },
  pregenTopic: async (data: PregenRequest) => {
    const response = await apiClient.post<PregenResponse>('/tests/pregen', data);
    return response.data;
  },
};

// --- OpenClaw Device Monitoring Types ---

export interface DeviceInfo {
  device_id: string;
  student_name: string;
  ip_address: string;
  status: 'online' | 'offline';
  last_seen: string;
}

export interface DevicesResponse {
  total: number;
  online: number;
  offline: number;
  devices: DeviceInfo[];
}

export interface FileEvent {
  event_type: string;
  path: string;
  is_directory: boolean;
  file_hash?: string | null;
  received_at: string;
}

export interface DeviceActivityResponse {
  device_id: string;
  student_name: string;
  total_returned: number;
  events: FileEvent[];
}

export interface FileState {
  path: string;
  file_hash?: string | null;
  last_event: string;
  last_seen: string;
}

export interface DeviceFilesResponse {
  device_id: string;
  student_name: string;
  total_files: number;
  files: FileState[];
}

export interface DeviceEventCount {
  device_id: string;
  student_name: string;
  event_count: number;
}

export interface RecentEvent {
  device_id: string;
  student_name: string;
  event_type: string;
  path: string;
  received_at: string;
}

export interface DashboardSummaryResponse {
  devices: { total: number; online: number; offline: number };
  file_events: { total: number; per_device: DeviceEventCount[] };
  recent_activity: RecentEvent[];
}

// --- Project Content (ChromaDB Evaluation) ---

export interface ProjectIngestResponse {
  topic: string;
  source: string;
  chunks_ingested: number;
  message: string;
}

export interface ProjectCollection {
  topic: string;
  collection: string;
  document_count: number;
}

export interface ProjectCollectionsResponse {
  collections: ProjectCollection[];
  total: number;
}

export interface ProjectDeleteResponse {
  topic: string;
  message: string;
}

export const projectContentApi = {
  ingestText: async (topic: string, content: string, source?: string): Promise<ProjectIngestResponse> => {
    const form = new FormData();
    form.append('topic', topic);
    form.append('content', content);
    if (source) form.append('source', source);
    const response = await apiClient.post<ProjectIngestResponse>('/project-content/ingest', form, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  },
  ingestFile: async (topic: string, file: File): Promise<ProjectIngestResponse> => {
    const form = new FormData();
    form.append('topic', topic);
    form.append('file', file);
    const response = await apiClient.post<ProjectIngestResponse>('/project-content/ingest-file', form, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  },
  listCollections: async (): Promise<ProjectCollectionsResponse> => {
    const response = await apiClient.get<ProjectCollectionsResponse>('/project-content/collections');
    return response.data;
  },
  deleteCollection: async (topic: string): Promise<ProjectDeleteResponse> => {
    const response = await apiClient.delete<ProjectDeleteResponse>(`/project-content/${encodeURIComponent(topic)}`);
    return response.data;
  },
};

// --- Learning Path ---

export interface LPCohort {
  _id: string;
  name: string;
  slug: string;
  icon: string;
  gradient: string;
  description: string;
  tech_stack: string[];
  duration_weeks: number;
}

export interface LPPhaseIn {
  name: string;
  order: number;
  topics: string[];
}

export interface LPAssessmentQuestion {
  id: string;
  type: 'mcq' | 'text' | 'scale';
  question: string;
  options?: string[];
  correct_index?: number;
  placeholder?: string;
  weight: number;
}

export interface LPCohortDetail extends LPCohort {
  phases: LPPhaseIn[];
  assessment_questions: LPAssessmentQuestion[];
  focus_area_options: string[];
  goal_options: string[];
}

export interface LPTopic {
  name: string;
  status: 'skip' | 'review' | 'learn';
  priority: 'high' | 'medium' | 'low';
  estimated_hours: number;
  description: string;
  resources: string[];
  why: string;
}

export interface LPPhaseOut {
  name: string;
  order: number;
  duration_weeks: number;
  focus: string;
  topics: LPTopic[];
}

export interface LearningPath {
  skill_level: 'beginner' | 'intermediate' | 'advanced';
  total_weeks: number;
  phases: LPPhaseOut[];
  personalized_notes: string;
  weekly_schedule: string;
  key_milestones: string[];
  generated_at?: string;
}

export interface AssessmentResult {
  skill_level: string;
  skill_pct: number;
  learning_path: LearningPath;
  cohort_slug: string;
  cohort_name: string;
}

export interface MCQAnswer { question_id: string; selected_option: number; }
export interface RoundAnswerSet { session_id: string; answers: MCQAnswer[]; }
export interface Step1Data {
  current_role: string;
  experience_years: number;
  education: string;
  programming_languages: string[];
  language_levels: Record<string, string>;
  project_types: string[];
  project_description: string;
}
export interface Step2Data { round_sessions: RoundAnswerSet[]; }
export interface Step3Data { goals: string[]; focus_areas: string[]; custom_goal: string; }
export interface Step4Data { hours_per_week: number; learning_style: string; prior_tools: string[]; }

export interface AssessmentSubmit {
  cohort_slug: string;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
}

export interface GenerateQuestionsRequest {
  cohort_slug: string;
  round: 1 | 2 | 3;
  known_topics: string[];
  language_levels: Record<string, string>;
  previous_session_id?: string;
  previous_answers?: MCQAnswer[];
}

export interface AssessmentRoundQuestion {
  id: string;
  question: string;
  options: string[];
  topic: string;
}

export interface PreviousRoundScore {
  correct: number;
  total: number;
  percentage: number;
  weak_areas: string[];
}

export interface GenerateQuestionsResponse {
  session_id: string;
  round: number;
  round_title: string;
  round_description: string;
  focus_topics: string[];
  rag_used: boolean;
  questions: AssessmentRoundQuestion[];
  previous_round_score: PreviousRoundScore | null;
}

export interface LPCollection { topic: string; collection: string; document_count: number; }
export interface LPCollectionsResponse { cohort_slug: string; collections: LPCollection[]; }

export const learningPathApi = {
  listCohorts: async (): Promise<{ cohorts: LPCohort[] }> => {
    const r = await apiClient.get('/learning-path/cohorts');
    return r.data;
  },
  getCohort: async (slug: string): Promise<LPCohortDetail> => {
    const r = await apiClient.get(`/learning-path/cohorts/${slug}`);
    return r.data;
  },
  generateAssessmentQuestions: async (payload: GenerateQuestionsRequest): Promise<GenerateQuestionsResponse> => {
    const r = await apiClient.post('/learning-path/generate-questions', payload, { timeout: 240_000 });
    return r.data;
  },
  submitAssessment: async (payload: AssessmentSubmit): Promise<AssessmentResult> => {
    const r = await apiClient.post('/learning-path/assess', payload);
    return r.data;
  },
  getMyProfile: async (cohortSlug?: string): Promise<{ profile: any | null }> => {
    const r = await apiClient.get('/learning-path/my-profile', { params: cohortSlug ? { cohort_slug: cohortSlug } : {} });
    return r.data;
  },
  resetProfile: async (cohortSlug: string) => {
    const r = await apiClient.delete(`/learning-path/my-profile/${cohortSlug}`);
    return r.data;
  },
  // Trainer
  createCohort: async (payload: any) => { const r = await apiClient.post('/learning-path/cohorts', payload); return r.data; },
  updateCohort: async (slug: string, payload: any) => { const r = await apiClient.put(`/learning-path/cohorts/${slug}`, payload); return r.data; },
  deleteCohort: async (slug: string) => { const r = await apiClient.delete(`/learning-path/cohorts/${slug}`); return r.data; },
  addQuestion: async (slug: string, q: any) => { const r = await apiClient.post(`/learning-path/cohorts/${slug}/questions`, q); return r.data; },
  updateQuestion: async (slug: string, qid: string, q: any) => { const r = await apiClient.put(`/learning-path/cohorts/${slug}/questions/${qid}`, q); return r.data; },
  deleteQuestion: async (slug: string, qid: string) => { const r = await apiClient.delete(`/learning-path/cohorts/${slug}/questions/${qid}`); return r.data; },
  ingestText: async (slug: string, topic: string, content: string, source?: string) => {
    const r = await apiClient.post(`/learning-path/cohorts/${slug}/ingest`, { topic, content, source: source || 'manual' });
    return r.data;
  },
  ingestFile: async (slug: string, topic: string, file: File) => {
    const form = new FormData();
    form.append('topic', topic);
    form.append('file', file);
    const r = await apiClient.post(`/learning-path/cohorts/${slug}/ingest-file`, form, { headers: { 'Content-Type': undefined } });
    return r.data;
  },
  listCollections: async (slug: string): Promise<LPCollectionsResponse> => {
    const r = await apiClient.get(`/learning-path/cohorts/${slug}/collections`);
    return r.data;
  },
  deleteCollection: async (slug: string, topic: string) => {
    const r = await apiClient.delete(`/learning-path/cohorts/${slug}/collections/${encodeURIComponent(topic)}`);
    return r.data;
  },
};

// --- Doubts / Image Q&A ---

export interface DoubtSource {
  content: string;
  topic: string;
}

export interface DoubtResponse {
  answer: string;
  image_analysis: string;
  sources: DoubtSource[];
  topic_used: string;
  rag_used: boolean;
}

export const doubtsApi = {
  askDoubt: async (question: string, topic?: string, image?: File): Promise<DoubtResponse> => {
    const form = new FormData();
    form.append('question', question);
    if (topic) form.append('topic', topic);
    if (image) form.append('image', image);
    const response = await apiClient.post<DoubtResponse>('/doubts/ask', form, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  },
};

export const devicesApi = {
  listDevices: async (): Promise<DevicesResponse> => {
    const response = await apiClient.get<DevicesResponse>('/openclaw/devices');
    return response.data;
  },
  getActivity: async (deviceId: string, limit = 50): Promise<DeviceActivityResponse> => {
    const response = await apiClient.get<DeviceActivityResponse>(`/openclaw/devices/${encodeURIComponent(deviceId)}/activity`, { params: { limit } });
    return response.data;
  },
  getFiles: async (deviceId: string): Promise<DeviceFilesResponse> => {
    const response = await apiClient.get<DeviceFilesResponse>(`/openclaw/devices/${encodeURIComponent(deviceId)}/files`);
    return response.data;
  },
  getSummary: async (): Promise<DashboardSummaryResponse> => {
    const response = await apiClient.get<DashboardSummaryResponse>('/openclaw/summary');
    return response.data;
  },
};
// --- Cohorts Analytics API ---
export interface StudentOverview {
  user_id: string;
  name: string;
  email: string;
  latest_score?: number | null;
}

export interface CohortOverview {
  total_students: number;
  average_score: number;
  total_performances: number;
  total_attendances: number;
  total_forum_posts: number;
}

export const cohortsApi = {
  listCohorts: async () => {
    const response = await apiClient.get<{ slug: string, name: string, student_count: number, average_score: number }[]>('/cohorts/');
    return response.data;
  },
  getStudents: async (slug: string) => {
    const response = await apiClient.get<StudentOverview[]>(`/cohorts/${slug}/students`);
    return response.data;
  },
  getOverview: async (slug: string) => {
    const response = await apiClient.get<CohortOverview>(`/cohorts/${slug}/overview`);
    return response.data;
  },
  getPerformance: async (slug: string) => {
    const response = await apiClient.get<PerformanceLog[]>(`/cohorts/${slug}/performance`);
    return response.data;
  },
  getAttendance: async (slug: string) => {
    const response = await apiClient.get<AttendanceSessionDetail[]>(`/cohorts/${slug}/attendance`);
    return response.data;
  },
  getForumPosts: async (slug: string) => {
    const response = await apiClient.get<Post[]>(`/cohorts/${slug}/forum`);
    return response.data;
  },
};

export default {
  apiClient,
  auth: authApi,
  users: usersApi,
  performance: performanceApi,
  forum: forumApi,
  feedbacks: feedbacksApi,
  system: systemApi,
  tests: testsApi,
  attendance: attendanceApi,
  devices: devicesApi,
  projectContent: projectContentApi,
  doubts: doubtsApi,
  learningPath: learningPathApi,
  cohorts: cohortsApi,
};

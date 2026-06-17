import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import ActivityPage from './pages/ActivityPage';
import TestsPage from './pages/TestsPage';
import ForumPage from './pages/ForumPage';
import UsersPage from './pages/UsersPage';
import AttendancePage from './pages/AttendancePage';
import DoubtsPage from './pages/DoubtsPage';
import LearningPathPage from './pages/LearningPathPage';
import AssessmentPage from './pages/AssessmentPage';
import LearningPathResultPage from './pages/LearningPathResultPage';
import LearningPathAdminPage from './pages/LearningPathAdminPage';
import GitHubPage from './pages/GitHubPage';
import LoginPage from './pages/LoginPage';
import CohortsPage from './pages/CohortsPage';
import ArenaPage from './pages/ArenaPage';
import RAGManagerPage from './pages/RAGManagerPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import './styles/index.css';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="tests" element={<TestsPage />} />
              <Route path="feedback" element={<Navigate to="/github" replace />} />
              <Route path="forum" element={<ForumPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="cohorts" element={<CohortsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="doubts" element={<DoubtsPage />} />
              <Route path="learning-path" element={<LearningPathPage />} />
              <Route path="learning-path/assess/:cohortSlug" element={<AssessmentPage />} />
              <Route path="learning-path/result" element={<LearningPathResultPage />} />
              <Route path="learning-path/trainer" element={<LearningPathAdminPage />} />
              <Route path="github" element={<GitHubPage />} />
              <Route path="arena" element={<ArenaPage />} />
              <Route path="arena/:lobbyId" element={<ArenaPage />} />
              <Route path="rag-manager" element={<RAGManagerPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import TasksPage from './pages/TasksPage';
import TestsPage from './pages/TestsPage';
import ReviewsPage from './pages/ReviewsPage';
import ForumPage from './pages/ForumPage';
import UsersPage from './pages/UsersPage';
import AttendancePage from './pages/AttendancePage';
import DoubtsPage from './pages/DoubtsPage';
import LearningPathPage from './pages/LearningPathPage';
import AssessmentPage from './pages/AssessmentPage';
import LearningPathResultPage from './pages/LearningPathResultPage';
import TrainerCurriculumPage from './pages/TrainerCurriculumPage';
import LoginPage from './pages/LoginPage';
import CohortsPage from './pages/CohortsPage';
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
              <Route path="tasks" element={<TasksPage />} />
              <Route path="tests" element={<TestsPage />} />
              <Route path="reviews" element={<ReviewsPage />} />
              <Route path="forum" element={<ForumPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="cohorts" element={<CohortsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="doubts" element={<DoubtsPage />} />
              <Route path="learning-path" element={<LearningPathPage />} />
              <Route path="learning-path/assess/:cohortSlug" element={<AssessmentPage />} />
              <Route path="learning-path/result" element={<LearningPathResultPage />} />
              <Route path="learning-path/trainer" element={<TrainerCurriculumPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

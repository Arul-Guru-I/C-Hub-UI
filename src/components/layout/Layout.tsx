import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CodeBackground from '../ui/CodeBackground';
import './Layout.css';

const PAGE_META: Record<string, { title: string; description: string }> = {
  '/':        { title: 'Home', description: 'Welcome back, Arul. Here\'s your overview.' },
  '/tasks':   { title: 'Tasks', description: 'Track and manage your team\'s work items.' },
  '/tests':   { title: 'Knowledge Tests', description: 'Test your understanding with AI-generated multiple choice quizzes.' },
  '/reviews': { title: 'Code Reviews', description: 'Review and approve pull requests.' },
  '/forum':   { title: 'Forum', description: 'Discuss, share, and get help from the community.' },
  '/users':      { title: 'Users', description: 'Manage user accounts, roles, and permissions.' },
  '/attendance': { title: 'Attendance', description: 'Track session attendance and check-ins.' },
};

const isMobile = () => window.innerWidth <= 768;

const pageVariants = {
  initial: { opacity: 0, y: 18, scale: 0.99 },
  animate: { opacity: 1, y: 0,  scale: 1 },
  exit:    { opacity: 0, y: -10, scale: 0.995 },
};

const pageTransition = {
  duration: 0.28,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(() => isMobile());
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? { title: 'CHub', description: '' };

  // Auto-close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile()) setCollapsed(true);
  }, [location.pathname]);

  return (
    <div className={`layout ${collapsed ? 'layout--collapsed' : ''}`}>
      <CodeBackground />
      {!collapsed && (
        <div className="layout__backdrop" onClick={() => setCollapsed(true)} />
      )}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="layout__main">
        <Topbar
          pageTitle={meta.title}
          pageDescription={meta.description}
          onMenuToggle={() => setCollapsed((c) => !c)}
        />
        <div className="layout__content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              style={{ minHeight: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Layout;

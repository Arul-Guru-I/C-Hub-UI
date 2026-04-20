import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import {
  HomeIcon, TaskIcon, TestIcon, ReviewIcon, ForumIcon, UsersIcon,
  LogoHexIcon, ChevronLeftIcon, ChevronRightIcon, UserIcon, LogOutIcon,
  AttendanceIcon, DoubtIcon, MapIcon,
} from '../ui/Icons';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const BASE_NAV = [
  { path: '/',                Icon: HomeIcon,       label: 'Home'          },
  { path: '/learning-path',   Icon: MapIcon,        label: 'Learning Path' },
  { path: '/tasks',           Icon: TaskIcon,       label: 'Tasks'         },
  { path: '/tests',           Icon: TestIcon,       label: 'Tests'         },
  { path: '/doubts',          Icon: DoubtIcon,      label: 'Doubts'        },
  { path: '/reviews',         Icon: ReviewIcon,     label: 'Reviews'       },
  { path: '/forum',           Icon: ForumIcon,      label: 'Forum'         },
  { path: '/attendance',      Icon: AttendanceIcon, label: 'Attendance'    },
];

const labelVariants = {
  hidden: { opacity: 0, x: -10, width: 0 },
  visible: {
    opacity: 1,
    x: 0,
    width: 'auto',
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
  exit: {
    opacity: 0,
    x: -8,
    width: 0,
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  },
};

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { user, logout } = useAuth();
  const isTrainer = user?.role === 'trainer';
  const navItems = isTrainer
    ? [
        ...BASE_NAV, 
        { path: '/cohorts', Icon: UsersIcon, label: 'Cohorts Analytics' },
        { path: '/users', Icon: UsersIcon, label: 'Users' }
      ]
    : BASE_NAV;

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <LogoHexIcon size={22} color="var(--color-primary)" className="sidebar__logo-icon" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                className="sidebar__logo-text"
                variants={labelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ overflow: 'hidden', display: 'block' }}
              >
                CHub
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.span
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ display: 'flex' }}
          >
            {collapsed
              ? <ChevronRightIcon size={15} />
              : <ChevronLeftIcon size={15} />
            }
          </motion.span>
        </button>
      </div>

      <div className="gold-divider sidebar__divider" />

      <nav className="sidebar__nav">
        {navItems.map(({ path, Icon, label }, i) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
            }
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <motion.span
              className="sidebar__nav-icon"
              whileHover={{ scale: 1.18 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              <Icon size={17} />
            </motion.span>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  className="sidebar__nav-label"
                  variants={labelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
            {collapsed && <span className="sidebar__tooltip">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer" style={{ borderTop: '1px solid rgba(79,142,255,0.08)', paddingTop: '16px' }}>
        <div className="sidebar__user" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <motion.div
              className="sidebar__user-avatar"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 350, damping: 18 }}
            >
              {user?.name?.charAt(0).toUpperCase() || <UserIcon size={14} color="#fff" />}
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  className="sidebar__user-info"
                  variants={labelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  <span className="sidebar__user-name" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name || 'User'}</span>
                  <span className="sidebar__user-role" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{user?.role || 'User'}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                onClick={logout}
                title="Logout"
                variants={labelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 350, damping: 18 }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', display: 'flex', padding: '4px' }}
              >
                <LogOutIcon size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SearchIcon, BellIcon, MenuIcon } from '../ui/Icons';
import './Topbar.css';

interface TopbarProps {
  pageTitle: string;
  pageDescription?: string;
  onMenuToggle?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ pageTitle, pageDescription, onMenuToggle }) => {
  const { user } = useAuth();
  return (
    <header className="topbar">
      <div className="topbar__left">
        {onMenuToggle && (
          <button className="topbar__mobile-menu-btn" onClick={onMenuToggle} aria-label="Toggle Menu">
            <MenuIcon size={24} />
          </button>
        )}
        <div className="topbar__title-group">
          <h1 className="topbar__title">{pageTitle}</h1>
          {pageDescription && (
            <p className="topbar__description">{pageDescription}</p>
          )}
        </div>
      </div>
      <div className="topbar__right">
        <div className="topbar__search">
          <span className="topbar__search-icon"><SearchIcon size={16} /></span>
          <input
            className="topbar__search-input"
            type="text"
            placeholder="Search anything..."
            aria-label="Global search"
          />
          <kbd className="topbar__search-kbd">⌘K</kbd>
        </div>
        <button className="topbar__icon-btn" aria-label="Notifications">
          <span className="topbar__notif-icon"><BellIcon size={17} /></span>
          <span className="topbar__notif-badge">3</span>
        </button>
        <div className="topbar__avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
      </div>
    </header>
  );
};

export default Topbar;

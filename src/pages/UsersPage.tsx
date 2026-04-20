import React, { useState, useEffect } from 'react';
import api from '../services/api';
import type { UserInDB, UserUpdate } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { EditIcon, TrashIcon, PlusIcon } from '../components/ui/Icons';
import './UsersPage.css';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserInDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UserUpdate>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [cohorts, setCohorts] = useState<string[]>([]);
  const [filterCohort, setFilterCohort] = useState<string>('all');
  const { user } = useAuth();
  const isTrainer = user?.role === 'admin' || user?.role === 'reviewer';

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await api.users.listUsers(0, 100, filterCohort === 'all' ? undefined : filterCohort);
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
      setError('Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    api.users.getAvailableCohorts().then(setCohorts).catch(console.error);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [filterCohort]);

  const startEdit = (u: UserInDB) => {
    setEditingId(u._id ?? null);
    setEditForm({ name: u.name, email: u.email, role: u.role ?? 'user', cohort: u.cohort ?? null });
    setDeleteConfirmId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setError('');
  };

  const handleSave = async (userId: string) => {
    setIsSaving(true);
    setError('');
    try {
      const updated = await api.users.updateUser(userId, editForm);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, ...updated } : u));
      setEditingId(null);
      setEditForm({});
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await api.users.deleteUser(userId);
      setUsers(prev => prev.filter(u => u._id !== userId));
      setDeleteConfirmId(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to delete user.');
    }
  };

  return (
    <div className="page-content users-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>User Management</h1>
          <p>View, edit roles, and remove users from the platform.</p>
        </div>
        {isTrainer && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-sec)', fontSize: '0.9rem' }}>Filter by Cohort:</span>
            <select
              className="form-input"
              value={filterCohort}
              onChange={e => setFilterCohort(e.target.value)}
              style={{ background: 'var(--color-surface-2)', padding: '6px 12px' }}
            >
              <option value="all">All</option>
              {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-sec)' }}>Loading users…</div>
      ) : (
        <div className="users-table-wrapper card">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>GitHub</th>
                <th>Cohort</th>
                <th>Role</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <React.Fragment key={u._id}>
                  <tr className={editingId === u._id ? 'users-row--editing' : ''}>
                    <td>
                      {editingId === u._id ? (
                        <input
                          className="form-input users-inline-input"
                          value={editForm.name ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        />
                      ) : (
                        <div className="users-name-cell">
                          <div className="users-avatar">
                            {u.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <span>{u.name}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {editingId === u._id ? (
                        <input
                          className="form-input users-inline-input"
                          type="email"
                          value={editForm.email ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        />
                      ) : (
                        <span className="users-email">{u.email}</span>
                      )}
                    </td>
                    <td>
                      <span className="users-github">{u.github_username || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</span>
                    </td>
                    <td>
                      {editingId === u._id ? (
                        <select
                          className="form-input users-inline-input"
                          value={editForm.cohort ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, cohort: e.target.value || null }))}
                          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-primary)' }}
                        >
                          <option value="">None</option>
                          {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="badge badge-accent">{u.cohort || 'None'}</span>
                      )}
                    </td>
                    <td>
                      {editingId === u._id ? (
                        <select
                          className="form-input users-inline-input"
                          value={editForm.role ?? 'user'}
                          onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="reviewer">reviewer</option>
                        </select>
                      ) : (
                        <span className={`badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'reviewer' ? 'badge-info' : 'badge-primary'}`}>
                          {u.role || 'user'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="users-actions">
                        {editingId === u._id ? (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => u._id && handleSave(u._id)}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-ghost btn-sm users-icon-btn"
                              title="Edit"
                              onClick={() => startEdit(u)}
                            >
                              <EditIcon size={14} />
                            </button>
                            {deleteConfirmId === u._id ? (
                              <>
                                <button
                                  className="btn btn-sm"
                                  style={{ background: 'var(--color-danger)', color: '#fff' }}
                                  onClick={() => u._id && handleDelete(u._id)}
                                >
                                  Confirm
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                              </>
                            ) : (
                              <button
                                className="btn btn-ghost btn-sm users-icon-btn"
                                title="Delete"
                                style={{ color: 'var(--color-danger)' }}
                                onClick={() => setDeleteConfirmId(u._id ?? null)}
                              >
                                <TrashIcon size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsersPage;

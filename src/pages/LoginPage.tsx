import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [cohort, setCohort] = useState('');
  const [availableCohorts, setAvailableCohorts] = useState<{ slug: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isRegistering) {
      api.users.getAvailableCohorts()
        .then(data => setAvailableCohorts(data))
        .catch(err => console.error('Failed to fetch cohorts', err));
    }
  }, [isRegistering]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isRegistering) {
        await api.users.createUser({
          name,
          email,
          password,
          github_username: githubUsername || undefined,
          cohort: cohort || undefined,
        });
        const tokenData = await api.auth.loginForAccessToken({ username: email, password });
        await login(tokenData.access_token);
      } else {
        const tokenData = await api.auth.loginForAccessToken({ username: email, password });
        await login(tokenData.access_token);
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      const errDetail = err?.response?.data?.detail;
      if (Array.isArray(errDetail)) {
        setError(errDetail[0]?.msg || 'Validation Error');
      } else if (typeof errDetail === 'string') {
        setError(errDetail);
      } else {
        setError('Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card card card-gradient anim-fade-up">
        <h2 className="login-title">CHub</h2>
        <p className="login-subtitle">
          {isRegistering ? 'Create a new account' : 'Sign in to your workspace'}
        </p>

        {error && <div className="login-error anim-slide-in">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {isRegistering && (
            <>
              <div className="form-group anim-slide-in">
                <label>Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="form-input"
                  placeholder="Arul Guru"
                />
              </div>
              <div className="form-group anim-slide-in">
                <label>GitHub Username <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="text"
                  value={githubUsername}
                  onChange={e => setGithubUsername(e.target.value)}
                  className="form-input"
                  placeholder="octocat"
                />
              </div>
              <div className="form-group anim-slide-in">
                <label>Cohort <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <select
                  value={cohort}
                  onChange={e => setCohort(e.target.value)}
                  className="form-input"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
                >
                  <option value="">Select a cohort...</option>
                  {availableCohorts.map(c => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="form-group">
            <label>Email / Username</label>
            <input
              type="text"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input"
              placeholder="user@example.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={isLoading}>
            {isLoading ? 'Processing...' : (isRegistering ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="login-toggle">
          {isRegistering ? 'Already have an account?' : 'Need an account?'}
          <button
            type="button"
            className="btn btn-ghost btn-sm toggle-btn"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
          >
            {isRegistering ? 'Sign In' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { isAuthenticated, setToken } from '../lib/auth';

type LoginResponse = {
  accessToken: string;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/app/tournaments', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const data = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: {
          email,
          password,
        },
      });
      setToken(data.accessToken);
      navigate('/app/tournaments', { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Login request failed',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="auth-card">
      <p className="eyebrow">Control Panel Access</p>
      <h1 className="auth-title">Sign in to FalconArena</h1>
      <p className="lead">
        Use an organizer, jury, team, or admin account to open your dashboard.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field" htmlFor="email">
          <span>Email</span>
          <input
            id="email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="field" htmlFor="password">
          <span>Password</span>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </article>
  );
}

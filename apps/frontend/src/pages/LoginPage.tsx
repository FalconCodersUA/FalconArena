import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { AuthUser, isAuthenticated, setAuthUser, setToken } from '../lib/auth';
import { useI18n } from '../i18n/I18nProvider';

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/app', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    const normalizedPassword = password;

    if (!normalizedEmail) {
      setError(t('login.validation.emailRequired'));
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError(t('login.validation.emailInvalid'));
      return;
    }

    if (!normalizedPassword) {
      setError(t('login.validation.passwordRequired'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const data = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: {
          email: normalizedEmail,
          password: normalizedPassword,
        },
      });
      setToken(data.accessToken);
      setAuthUser(data.user);
      navigate('/app', { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('login.requestFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="auth-card">
      <p className="eyebrow">{t('login.eyebrow')}</p>
      <h1 className="auth-title">{t('login.title')}</h1>
      <p className="lead">{t('login.lead')}</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="field" htmlFor="email">
          <span>{t('login.email')}</span>
          <input
            id="email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) {
                setError('');
              }
            }}
            required
          />
        </label>

        <label className="field" htmlFor="password">
          <span>{t('login.password')}</span>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) {
                setError('');
              }
            }}
            required
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      <p className="auth-footnote">
        {t('login.registerHint')}{' '}
        <Link to="/app/register">{t('login.registerAction')}</Link>
      </p>
    </article>
  );
}

import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { AuthUser, isAuthenticated, setAuthUser, setToken } from '../lib/auth';
import { useI18n } from '../i18n/I18nProvider';

type RegisterResponse = {
  accessToken: string;
  user: AuthUser;
};

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/app', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedFullName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedFullName.length < 2 || normalizedFullName.length > 80) {
      setError(t('register.validation.fullNameLength'));
      return;
    }

    if (!normalizedEmail) {
      setError(t('register.validation.emailRequired'));
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError(t('register.validation.emailInvalid'));
      return;
    }

    if (password.length < 8 || password.length > 128) {
      setError(t('register.validation.passwordLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('register.validation.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const data = await apiRequest<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: {
          fullName: normalizedFullName,
          email: normalizedEmail,
          password,
        },
      });
      setToken(data.accessToken);
      setAuthUser(data.user);
      navigate('/app/team', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('register.requestFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  function clearError() {
    if (error) {
      setError('');
    }
  }

  return (
    <article className="auth-card">
      <p className="eyebrow">{t('register.eyebrow')}</p>
      <h1 className="auth-title">{t('register.title')}</h1>
      <p className="lead">{t('register.lead')}</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="field" htmlFor="register-full-name">
          <span>{t('register.fullName')}</span>
          <input
            id="register-full-name"
            type="text"
            value={fullName}
            autoComplete="name"
            onChange={(event) => {
              setFullName(event.target.value);
              clearError();
            }}
            required
          />
        </label>

        <label className="field" htmlFor="register-email">
          <span>{t('register.email')}</span>
          <input
            id="register-email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => {
              setEmail(event.target.value);
              clearError();
            }}
            required
          />
        </label>

        <label className="field" htmlFor="register-password">
          <span>{t('register.password')}</span>
          <input
            id="register-password"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => {
              setPassword(event.target.value);
              clearError();
            }}
            required
          />
        </label>

        <label className="field" htmlFor="register-confirm-password">
          <span>{t('register.confirmPassword')}</span>
          <input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearError();
            }}
            required
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? t('register.submitting') : t('register.submit')}
        </button>
      </form>

      <p className="auth-footnote">
        {t('register.loginHint')}{' '}
        <Link to="/app/login">{t('register.loginAction')}</Link>
      </p>
    </article>
  );
}

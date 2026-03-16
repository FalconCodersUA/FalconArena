import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthSplitLayout from '../app/layout/AuthSplitLayout';
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedFullName = `${normalizedFirstName} ${normalizedLastName}`.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedFirstName.length < 2 || normalizedFirstName.length > 40) {
      setError(t('register.validation.firstNameLength'));
      return;
    }

    if (normalizedLastName.length < 2 || normalizedLastName.length > 40) {
      setError(t('register.validation.lastNameLength'));
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
    <AuthSplitLayout
      variant="register"
      panelTitle={t('register.panelTitle')}
      panelLead={t('register.panelLead')}
      introTitle={t('register.title')}
      introLead={t('register.lead')}
      steps={[
        { index: 1, title: t('register.steps.account'), active: true },
        { index: 2, title: t('register.steps.workspace') },
        { index: 3, title: t('register.steps.profile') },
      ]}
      footer={
        <p className="auth-footnote auth-footnote-centered">
          {t('register.loginHint')}{' '}
          <Link to="/app/login">{t('register.loginAction')}</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-name-grid">
          <label className="field auth-field" htmlFor="register-first-name">
            <span>{t('register.firstName')}</span>
            <input
              id="register-first-name"
              type="text"
              placeholder={t('register.placeholders.firstName')}
              value={firstName}
              autoComplete="given-name"
              onChange={(event) => {
                setFirstName(event.target.value);
                clearError();
              }}
              required
            />
          </label>

          <label className="field auth-field" htmlFor="register-last-name">
            <span>{t('register.lastName')}</span>
            <input
              id="register-last-name"
              type="text"
              placeholder={t('register.placeholders.lastName')}
              value={lastName}
              autoComplete="family-name"
              onChange={(event) => {
                setLastName(event.target.value);
                clearError();
              }}
              required
            />
          </label>
        </div>

        <label className="field auth-field" htmlFor="register-email">
          <span>{t('register.email')}</span>
          <input
            id="register-email"
            type="email"
            placeholder={t('register.placeholders.email')}
            value={email}
            autoComplete="email"
            onChange={(event) => {
              setEmail(event.target.value);
              clearError();
            }}
            required
          />
        </label>

        <label className="field auth-field" htmlFor="register-password">
          <span>{t('register.password')}</span>
          <input
            id="register-password"
            type="password"
            placeholder={t('register.placeholders.password')}
            value={password}
            autoComplete="new-password"
            onChange={(event) => {
              setPassword(event.target.value);
              clearError();
            }}
            required
          />
        </label>

        <p className="auth-password-hint">{t('register.passwordHint')}</p>

        <label className="field auth-field" htmlFor="register-confirm-password">
          <span>{t('register.confirmPassword')}</span>
          <input
            id="register-confirm-password"
            type="password"
            placeholder={t('register.placeholders.confirmPassword')}
            value={confirmPassword}
            autoComplete="new-password"
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearError();
            }}
            required
          />
        </label>

        {error ? <p className="form-error auth-form-error">{error}</p> : null}

        <button className="button auth-submit-button" type="submit" disabled={submitting}>
          {submitting ? t('register.submitting') : t('register.submit')}
        </button>
      </form>
    </AuthSplitLayout>
  );
}

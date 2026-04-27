import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthRole, AuthUser, setAuthUser, setToken } from '../lib/auth';
import { useI18n } from '../i18n/I18nProvider';

const AUTH_ROLES: AuthRole[] = ['ADMIN', 'TEAM', 'JURY', 'ORGANIZER'];

function parseOAuthUser(value: string | null): AuthUser | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AuthUser>;
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.fullName === 'string' &&
      typeof parsed.role === 'string' &&
      AUTH_ROLES.includes(parsed.role as AuthRole)
    ) {
      return {
        id: parsed.id,
        email: parsed.email,
        fullName: parsed.fullName,
        role: parsed.role as AuthRole,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [error, setError] = useState('');

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(t('auth.oauth.callbackError'));
      return;
    }

    const accessToken = searchParams.get('accessToken');
    const user = parseOAuthUser(searchParams.get('user'));
    if (!accessToken || !user) {
      setError(t('auth.oauth.callbackError'));
      return;
    }

    setToken(accessToken);
    setAuthUser(user);
    navigate('/app/dashboard', { replace: true });
  }, [navigate, searchParams, t]);

  return (
    <article className="card state-card auth-callback-card">
      <h1>{error ? t('auth.oauth.callbackTitleFailed') : t('auth.oauth.callbackTitle')}</h1>
      <p>{error || t('auth.oauth.callbackLead')}</p>
      {error ? (
        <Link to="/app/login" className="button button-primary">
          {t('auth.oauth.backToLogin')}
        </Link>
      ) : null}
    </article>
  );
}

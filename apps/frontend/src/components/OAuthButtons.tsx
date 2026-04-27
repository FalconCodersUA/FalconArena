import { buildApiUrl } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

type OAuthProvider = 'google' | 'github';

const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'github'];

function OAuthIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === 'google') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.37a4.59 4.59 0 0 1-1.99 3.01v2.5h3.22c1.88-1.73 3-4.28 3-7.5Z"
          fill="#4285F4"
        />
        <path
          d="M12 22c2.7 0 4.96-.89 6.6-2.42l-3.22-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A9.99 9.99 0 0 0 12 22Z"
          fill="#34A853"
        />
        <path
          d="M6.41 13.92A6.01 6.01 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.51l3.33-2.59Z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.96c1.47 0 2.78.5 3.82 1.49l2.86-2.86C16.96 2.98 14.7 2 12 2a9.99 9.99 0 0 0-8.92 5.49l3.33 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
          fill="#EA4335"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.86 8.35 6.84 9.71.5.1.68-.22.68-.5v-1.74c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.1-1.49-1.1-1.49-.91-.64.06-.63.06-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.36 9.36 0 0 1 12 6.93c.85 0 1.7.12 2.5.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9v2.78c0 .28.18.6.69.5A10.08 10.08 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function OAuthButtons() {
  const { t } = useI18n();

  function startOAuth(provider: OAuthProvider) {
    window.location.assign(buildApiUrl(`/auth/${provider}`));
  }

  return (
    <div className="auth-oauth-grid">
      {OAUTH_PROVIDERS.map((provider) => (
        <button
          key={provider}
          type="button"
          className={`auth-oauth-button auth-oauth-button--${provider}`}
          onClick={() => startOAuth(provider)}
        >
          <span aria-hidden>
            <OAuthIcon provider={provider} />
          </span>
          {t(`auth.oauth.${provider}`)}
        </button>
      ))}
    </div>
  );
}

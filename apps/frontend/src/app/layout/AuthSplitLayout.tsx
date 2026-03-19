import { ReactNode } from 'react';
import AuthBrandLogo from './AuthBrandLogo';

type Step = {
  index: number;
  title: string;
  active?: boolean;
};

type AuthSplitLayoutProps = {
  variant: 'login' | 'register';
  panelTitle: string;
  panelLead: string;
  introTitle: string;
  introLead: string;
  children: ReactNode;
  footer?: ReactNode;
  steps?: Step[];
};

export default function AuthSplitLayout({
  variant,
  panelTitle,
  panelLead,
  introTitle,
  introLead,
  children,
  footer,
  steps,
}: AuthSplitLayoutProps) {
  return (
    <section className={`auth-split auth-split-${variant}`}>
      <div className="auth-promo">
        <div className="auth-promo-art">
          <div className="auth-mark-ring">
            <AuthBrandLogo
              className="auth-brand-logo"
              opacity={variant === 'register' ? 0.15 : 0.18}
              variant={variant === 'login' ? 'login-full' : 'default'}
            />
          </div>
        </div>

        <div className={`auth-promo-bottom${steps && steps.length > 0 ? ' has-steps' : ''}`}>
          <div className="auth-promo-copy">
            <h2>{panelTitle}</h2>
            <p>{panelLead}</p>
          </div>

          {steps && steps.length > 0 ? (
            <div className="auth-steps-grid">
              {steps.map((step) => (
                <article
                  key={`${step.index}-${step.title}`}
                  className={`auth-step-card${step.active ? ' active' : ''}`}
                >
                  <span>{step.index}</span>
                  <strong>{step.title}</strong>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <article className="auth-surface">
        <div className="auth-surface-copy">
          <h1 className="auth-title">{introTitle}</h1>
          <p className="auth-subtitle">{introLead}</p>
        </div>

        {children}

        {footer ? <div className="auth-footer">{footer}</div> : null}
      </article>
    </section>
  );
}

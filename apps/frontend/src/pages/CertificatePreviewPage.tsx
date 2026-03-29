import { CSSProperties, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { useI18n } from '../i18n/I18nProvider';

type CertificateKind = 'participation' | 'winner';

type CertificateResponse = {
  tournament: {
    id: string;
    title: string;
    status: string;
    startsAt: string | null;
  };
  team: {
    id: string;
    name: string;
    captain: {
      id: string;
      fullName: string;
      email: string;
    };
    members: Array<{
      id: string;
      fullName: string;
      email: string;
      isCaptain: boolean;
    }>;
  };
  result: {
    rank: number | null;
    totalScore: number | null;
    averageScore: number | null;
  };
  certificate: {
    kind: CertificateKind;
    kindLabel: string;
    issuedAt: string;
    template: {
      id: string | null;
      tournamentId: string;
      isDefault: boolean;
      name: string;
      title: string;
      subtitle: string;
      body: string;
      footer: string;
      signerName: string;
      signerRole: string;
      accentColor: string;
    };
  };
};

export default function CertificatePreviewPage() {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<CertificateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tournamentId = searchParams.get('tournamentId') ?? '';
  const teamId = searchParams.get('teamId') ?? '';
  const kind = (searchParams.get('kind') as CertificateKind | null) ?? 'participation';

  useEffect(() => {
    async function loadCertificate() {
      if (!tournamentId || !teamId) {
        setError(t('certificatePage.missingParams'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await apiRequest<CertificateResponse>(
          `/tournaments/${tournamentId}/certificates/teams/${teamId}?kind=${kind}`,
        );
        setData(response);
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : t('certificatePage.loadFailed'),
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    void loadCertificate();
  }, [kind, teamId, tournamentId, t]);

  if (loading) {
    return <section className="certificate-page-shell">{t('certificatePage.loading')}</section>;
  }

  if (error || !data) {
    return (
      <section className="certificate-page-shell">
        <article className="certificate-page-panel">
          <h1>{t('certificatePage.title')}</h1>
          <p className="form-error">{error || t('certificatePage.loadFailed')}</p>
          <div className="certificate-page-actions">
            <button type="button" className="button button-soft" onClick={() => navigate(-1)}>
              {t('certificatePage.back')}
            </button>
          </div>
        </article>
      </section>
    );
  }

  const template = data.certificate.template;

  return (
    <section className="certificate-page-shell">
      <div className="certificate-page-actions no-print">
        <button type="button" className="button button-soft" onClick={() => navigate(-1)}>
          {t('certificatePage.back')}
        </button>
        <button type="button" className="button button-primary" onClick={() => window.print()}>
          {t('certificatePage.print')}
        </button>
      </div>

      <article
        className="certificate-sheet"
        style={{ '--certificate-accent': template.accentColor } as CSSProperties}
      >
        <div className="certificate-sheet-frame">
          <span className="certificate-sheet-kicker">{data.certificate.kindLabel}</span>
          <h1>{template.title}</h1>
          {template.subtitle ? <p className="certificate-sheet-subtitle">{template.subtitle}</p> : null}

          <div className="certificate-sheet-recipient">
            <span>{t('certificatePage.awardedTo')}</span>
            <strong>{data.team.name}</strong>
          </div>

          <p className="certificate-sheet-body">{template.body}</p>

          <dl className="certificate-sheet-meta">
            <div>
              <dt>{t('certificatePage.tournament')}</dt>
              <dd>{data.tournament.title}</dd>
            </div>
            <div>
              <dt>{t('certificatePage.issuedAt')}</dt>
              <dd>{formatDateTime(data.certificate.issuedAt, language)}</dd>
            </div>
            <div>
              <dt>{t('certificatePage.rank')}</dt>
              <dd>{data.result.rank ?? '-'}</dd>
            </div>
            <div>
              <dt>{t('certificatePage.totalScore')}</dt>
              <dd>{data.result.totalScore !== null ? data.result.totalScore.toFixed(2) : '-'}</dd>
            </div>
          </dl>

          <div className="certificate-sheet-members">
            <span>{t('certificatePage.teamMembers')}</span>
            <ul>
              {data.team.members.map((member) => (
                <li key={member.id}>
                  <strong>{member.fullName}</strong>
                  {member.isCaptain ? ` — ${t('certificatePage.captain')}` : ''}
                </li>
              ))}
            </ul>
          </div>

          <footer className="certificate-sheet-footer">
            <div>
              {template.signerName ? <strong>{template.signerName}</strong> : null}
              {template.signerRole ? <span>{template.signerRole}</span> : null}
            </div>
            {template.footer ? <p>{template.footer}</p> : null}
          </footer>
        </div>
      </article>
    </section>
  );
}

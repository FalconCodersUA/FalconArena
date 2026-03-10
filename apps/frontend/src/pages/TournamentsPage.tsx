import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';

type Tournament = {
  id: string;
  title: string;
  status: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  canTeamRegister: boolean;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function TournamentsPage() {
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadTournaments() {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<Tournament[]>('/tournaments');
      setItems(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load tournaments',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTournaments();
  }, []);

  const cards = useMemo(
    () =>
      items.map((tournament) => (
        <article key={tournament.id} className="card tournament-card">
          <div className="tournament-head">
            <h2>{tournament.title}</h2>
            <span className="status-pill">{tournament.status}</span>
          </div>

          <dl className="meta-grid">
            <div>
              <dt>Registration opens</dt>
              <dd>{formatDate(tournament.registrationOpenAt)}</dd>
            </div>
            <div>
              <dt>Registration closes</dt>
              <dd>{formatDate(tournament.registrationCloseAt)}</dd>
            </div>
          </dl>

          <p className="register-flag">
            Team registration: {tournament.canTeamRegister ? 'available' : 'closed'}
          </p>
        </article>
      )),
    [items],
  );

  if (loading) {
    return <div className="card state-card">Loading tournaments...</div>;
  }

  if (error) {
    return (
      <div className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={loadTournaments}>
          Try again
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="card state-card">No tournaments available yet.</div>;
  }

  return (
    <section className="tournaments-section">
      <header className="section-header">
        <p className="eyebrow">Live Data</p>
        <h1>Tournament list</h1>
      </header>
      <div className="tournaments-grid">{cards}</div>
    </section>
  );
}

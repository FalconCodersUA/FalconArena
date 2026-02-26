const roles = [
  {
    title: 'Admin',
    text: 'Creates tournaments, starts rounds, and controls evaluation windows.',
  },
  {
    title: 'Team',
    text: 'Registers members, tracks deadlines, and submits project links.',
  },
  {
    title: 'Jury',
    text: 'Reviews assigned projects with transparent scoring and comments.',
  },
];

const phases = [
  {
    name: 'Registration Window',
    detail: 'Teams join during the configured period with duplicate checks.',
  },
  {
    name: 'Task Is Active',
    detail: 'Teams receive must-have checklist, materials, and deadline timer.',
  },
  {
    name: 'Submission Stage',
    detail: 'Repository and demo links are editable until deadline lock.',
  },
  {
    name: 'Jury Evaluation',
    detail: 'Assigned scores are aggregated into a single public leaderboard.',
  },
];

const stack = ['React + Vite', 'NestJS', 'Prisma', 'PostgreSQL', 'Redis', 'Docker'];

const leaderboard = [
  { name: 'Byte Nomads', score: 94 },
  { name: 'Null Pointers', score: 91 },
  { name: 'Syntax Squad', score: 88 },
  { name: 'Stack Surge', score: 85 },
];

export default function App() {
  return (
    <main className="page">
      <section className="hero reveal">
        <div className="hero-copy">
          <p className="eyebrow">FalconArena Tournament Hub</p>
          <h1>Build, Submit, Evaluate, Rank</h1>
          <p className="lead">
            A modern tournament platform where teams ship results before the deadline and
            jury members score submissions with clear criteria.
          </p>

          <div className="hero-actions">
            <a className="button button-primary" href="/health">
              Platform Health
            </a>
            <span className="button button-soft">CI/CD Connected</span>
          </div>

          <ul className="chip-row" aria-label="Current stack">
            {stack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <aside className="hero-panel" aria-label="Round status preview">
          <p>Round 01 is active</p>
          <h2>Submission deadline in 18h 42m</h2>
          <dl>
            <div>
              <dt>Registered teams</dt>
              <dd>32</dd>
            </div>
            <div>
              <dt>Submitted now</dt>
              <dd>19</dd>
            </div>
            <div>
              <dt>Jury members</dt>
              <dd>8</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="grid reveal" aria-label="System roles">
        {roles.map((role) => (
          <article key={role.title} className="card">
            <h2>{role.title}</h2>
            <p>{role.text}</p>
          </article>
        ))}
      </section>

      <section className="timeline reveal" aria-label="Tournament lifecycle">
        <header>
          <p className="eyebrow">Round Flow</p>
          <h2>One consistent journey for every challenge</h2>
        </header>

        <div className="timeline-grid">
          {phases.map((phase, index) => (
            <article key={phase.name} className="phase">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{phase.name}</h3>
              <p>{phase.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="leaderboard reveal" aria-label="Leaderboard preview">
        <header>
          <p className="eyebrow">Leaderboard Preview</p>
          <h2>Scoring overview during evaluation</h2>
        </header>

        <div className="board">
          {leaderboard.map((team, index) => (
            <article key={team.name} className="entry">
              <div className="entry-head">
                <strong>
                  {index + 1}. {team.name}
                </strong>
                <span>{team.score}</span>
              </div>
              <div className="bar">
                <i style={{ width: `${team.score}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

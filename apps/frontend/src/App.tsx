const roles = [
  {
    title: 'Admin',
    text: 'Creates tournaments, controls rounds, and reviews final results.',
  },
  {
    title: 'Team',
    text: 'Registers participants, tracks deadlines, and submits deliverables.',
  },
  {
    title: 'Jury',
    text: 'Evaluates assigned submissions with transparent scoring criteria.',
  },
];

export default function App() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">FalconArena</p>
        <h1>Team Programming Tournament Platform</h1>
        <p>
          Monorepo scaffold is ready: React + Vite on frontend, NestJS on backend,
          Prisma with PostgreSQL, and Redis for async-ready workflows.
        </p>
      </section>

      <section className="grid" aria-label="System roles">
        {roles.map((role) => (
          <article key={role.title} className="card">
            <h2>{role.title}</h2>
            <p>{role.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

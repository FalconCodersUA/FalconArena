import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <article className="card state-card">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="lead">The route does not exist in this app version.</p>
      <Link className="button button-primary" to="/tournaments">
        Go to tournaments
      </Link>
    </article>
  );
}

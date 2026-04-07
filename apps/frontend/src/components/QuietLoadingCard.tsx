type QuietLoadingCardProps = {
  label: string;
};

export default function QuietLoadingCard({ label }: QuietLoadingCardProps) {
  return (
    <article className="card state-card state-card--quiet-loading" aria-label={label}>
      <span className="visually-hidden">{label}</span>
      <span className="state-card-quiet-line state-card-quiet-line--title" aria-hidden />
      <span className="state-card-quiet-line state-card-quiet-line--body" aria-hidden />
    </article>
  );
}

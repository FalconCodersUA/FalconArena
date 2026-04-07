type QuietLoadingInlineProps = {
  label: string;
  compact?: boolean;
};

export default function QuietLoadingInline({
  label,
  compact = false,
}: QuietLoadingInlineProps) {
  return (
    <div
      className={`quiet-inline-loading${compact ? ' is-compact' : ''}`}
      aria-label={label}
    >
      <span className="visually-hidden">{label}</span>
      <span className="quiet-inline-loading-line quiet-inline-loading-line--title" aria-hidden />
      <span className="quiet-inline-loading-line quiet-inline-loading-line--body" aria-hidden />
    </div>
  );
}

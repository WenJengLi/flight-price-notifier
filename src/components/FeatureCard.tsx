type FeatureCardProps = { number: string; title: string; subtitle: string; description: string }

export function FeatureCard({ number, title, subtitle, description }: FeatureCardProps) {
  return <article className="feature-card"><span className="feature-number">{number}</span><h3>{title}</h3><span className="feature-subtitle">{subtitle}</span><p>{description}</p></article>
}
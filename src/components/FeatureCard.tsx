type FeatureCardProps = { number: string; title: string; subtitle: string; description: string }

export function FeatureCard({ number, title, subtitle, description }: FeatureCardProps) {
  return <article className="feature-card"><span className="feature-number">{number}</span><h2>{title}</h2><p>{subtitle}<br />{description}</p></article>
}
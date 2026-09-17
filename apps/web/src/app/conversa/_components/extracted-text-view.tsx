export function ExtractedTextView({ text }: { text: string }) {
  return (
    <section aria-labelledby="extracted-text-title" className="import-extracted-text">
      <p className="section-kicker">Visão linear</p>
      <h2
        id="extracted-text-title"
        className="mt-2 font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--color-navy)]"
      >
        O que o robô do ATS enxerga
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
        Este é o texto na ordem em que foi extraído, sem interpretar ou completar informações.
      </p>
      <pre className="import-extracted-content">{text}</pre>
    </section>
  );
}

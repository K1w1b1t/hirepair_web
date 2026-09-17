import type { DiagnosticFinding, FindingSeverity } from '../_lib/diagnostic';

const severityLabels: Record<FindingSeverity, string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MEDIUM: 'Médio',
  LOW: 'Baixo',
};

export function DiagnosticFindings({ findings }: { findings: DiagnosticFinding[] }) {
  if (findings.length === 0) {
    return (
      <div className="import-clear-state" role="status">
        <strong>O texto foi lido sem achados nesta etapa.</strong>
        <span>A leitura mostra o que o sistema conseguiu encontrar no seu documento.</span>
      </div>
    );
  }

  return (
    <div aria-label="Achados do diagnóstico" className="import-findings" role="list">
      {findings.map((finding) => (
        <article
          className={`import-finding import-finding-${finding.severity.toLowerCase()}`}
          key={`${finding.kind}-${finding.title}`}
          role="listitem"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--color-navy)]">
              {finding.title}
            </h3>
            <span className="import-severity-badge">{severityLabels[finding.severity]}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{finding.fact}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-main)]">{finding.detail}</p>
        </article>
      ))}
    </div>
  );
}

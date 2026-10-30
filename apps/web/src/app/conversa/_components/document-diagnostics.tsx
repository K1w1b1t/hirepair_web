'use client';

import { useEffect, useState } from 'react';
import type { DiagnosticReport, Strategy, Session } from '@hirepair/interview-engine';
import { diagnoseStoredDocuments, persistDiagnosticReports } from '../_lib/diagnostic';
import { readEngine } from '../_lib/engine-storage';
import { updateStoredResume, type StoredResume } from '../_lib/resume-storage';

const severityLabels = { CRITICAL: 'Crítico', HIGH: 'Alto', MEDIUM: 'Médio', LOW: 'Baixo' };
const storageMessage =
  'Não foi possível salvar o diagnóstico ou sua alteração neste aparelho. Reabra a jornada para usar a versão atual; a retomada não está garantida.';

export function DocumentDiagnostics({
  documents,
  target = '',
  archetype,
  onChange,
  onSessionChange,
}: {
  documents: StoredResume[];
  target?: string;
  archetype?: Strategy['archetype'];
  onChange: (documents: StoredResume[]) => void;
  onSessionChange?: (session: Session) => void;
}) {
  const [state, setState] = useState<{ key: string; reports: DiagnosticReport[] }>({
    key: '',
    reports: [],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  // Hide stale findings synchronously when materials or context change, before effects run.
  const key = JSON.stringify({
    documents: documents.map((doc) => ({
      id: doc.id,
      text: doc.text,
      materialKind: doc.materialKind,
      usedInApplications: doc.usedInApplications,
      pageCount: doc.pageCount,
      pages: doc.pages,
    })),
    target,
    archetype,
  });
  useEffect(() => {
    let active = true;
    setError('');
    setRefreshing(true);
    const refresh = async () => {
      let session;
      try {
        session = await readEngine();
      } catch {
        session = undefined;
      }
      const reports = await diagnoseStoredDocuments(
        documents,
        target,
        archetype,
        session ?? undefined,
      );
      if (!active) return;
      setState({ key, reports });
      const updated = await persistDiagnosticReports(documents, reports);
      if (onSessionChange) {
        const latest = await readEngine();
        if (active && latest) onSessionChange(latest);
      }
      if (active && updated.some((doc, i) => doc !== documents[i])) onChange(updated);
    };
    void refresh()
      .catch(() => {
        if (active) setError(storageMessage);
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [documents, target, archetype, onChange, onSessionChange, key]);

  const update = async (doc: StoredResume, changes: Parameters<typeof updateStoredResume>[2]) => {
    setBusy(true);
    setError('');
    try {
      const updated = await updateStoredResume(doc.id, doc.revision ?? 0, changes);
      onChange(documents.map((item) => (item.id === doc.id ? updated : item)));
    } catch {
      setError(storageMessage);
    } finally {
      setBusy(false);
    }
  };
  const reports = state.key === key ? state.reports : [];
  return (
    <section aria-label="Diagnóstico dos documentos" className="document-diagnostics">
      <h2>O que encontramos nos seus documentos</h2>
      <p>
        Os alertas descrevem este material. Hipóteses precisam de esclarecimento e não provam falta
        de competência.
      </p>
      {documents.every((doc) => doc.materialKind === 'story') ? (
        <p>
          Sem currículo para diagnosticar. Seus relatos podem ser usados na coleta de história, sem
          inventar um diagnóstico.
        </p>
      ) : null}
      {documents.map((doc) => (
        <article
          key={doc.id}
          aria-label={`Diagnóstico de ${doc.fileName}`}
          className="diagnostic-document"
        >
          <h3>Diagnóstico: {doc.fileName}</h3>
          <label>
            Tipo de material
            <select
              aria-label={`Tipo de material de ${doc.fileName}`}
              disabled={busy || refreshing}
              value={doc.materialKind ?? 'resume'}
              onChange={(event) =>
                void update(doc, { materialKind: event.target.value as 'resume' | 'story' })
              }
            >
              <option value="resume">Currículo</option>
              <option value="story">Relato da minha história</option>
            </select>
          </label>
          {doc.materialKind !== 'story' ? (
            <>
              <label>
                Este currículo é o usado nas candidaturas?
                <select
                  aria-label={`Este currículo é o usado nas candidaturas? ${doc.fileName}`}
                  disabled={busy || refreshing}
                  value={doc.usedInApplications ?? 'unknown'}
                  onChange={(event) =>
                    void update(doc, {
                      usedInApplications: event.target.value as 'yes' | 'no' | 'unknown',
                    })
                  }
                >
                  <option value="unknown">Ainda não confirmei</option>
                  <option value="yes">Sim</option>
                  <option value="no">Não, é outra versão</option>
                </select>
              </label>
              {reports
                .filter((report) => report.document?.id === doc.id)
                .map((report) => (
                  <div key={report.contextVersion}>
                    {report.limitations.map((limitation) => (
                      <p key={limitation} className="diagnostic-limitation">
                        {limitation}
                      </p>
                    ))}
                    {report.findings.length === 0 ? (
                      <p>
                        Nenhum achado nas regras aplicáveis. Isso não é aprovação nem garantia de
                        leitura em sistemas de triagem.
                      </p>
                    ) : (
                      <ul aria-label={`Achados de ${doc.fileName}`}>
                        {report.findings.map((finding) => (
                          <li key={finding.id} className="diagnostic-finding">
                            <p>
                              <strong>{severityLabels[finding.severity]}</strong> ·{' '}
                              <span>
                                {finding.nature === 'observed' ? 'Observado' : 'Hipótese'}
                              </span>
                            </p>
                            <h4>{finding.title}</h4>
                            <p>{finding.explanation}</p>
                            {finding.evidence.map((evidence, i) => (
                              <blockquote key={i}>
                                {evidence.quote ||
                                  `${report.document!.pageCount} páginas medidas pelo parser`}
                                {evidence.page === undefined ? null : (
                                  <small> · Página {evidence.page}</small>
                                )}
                              </blockquote>
                            ))}
                            <p>
                              <strong>O que fazer: </strong>
                              {finding.action}
                            </p>
                            {finding.restriction ? (
                              <p role="note">
                                Restrição para este arquivo:{' '}
                                {finding.restriction.destinations
                                  .map((destination) =>
                                    destination === 'standard'
                                      ? 'currículo padrão'
                                      : 'submissão em sistema de triagem',
                                  )
                                  .join(', ')}
                                . Você pode continuar revisando e confirmando sua história.
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    <details>
                      <summary>Ver texto extraído</summary>
                      <pre className="diagnostic-extracted-text">{doc.text}</pre>
                    </details>
                  </div>
                ))}
              <details>
                <summary>Corrigir ou substituir o texto</summary>
                <p>
                  Para substituir o arquivo original, remova o material e importe a versão
                  corrigida. Salvar o texto não altera o arquivo original, que permanece neste
                  aparelho até você excluir o material. A paginação anterior deixa de valer.
                </p>
                <form
                  aria-label={`Corrigir texto de ${doc.fileName}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = String(new FormData(event.currentTarget).get('text')).trim();
                    if (text) void update(doc, { text });
                  }}
                >
                  <label>
                    Texto do currículo
                    <textarea
                      aria-label={`Texto do currículo de ${doc.fileName}`}
                      name="text"
                      defaultValue={doc.text}
                      key={doc.text}
                      required
                      rows={6}
                    />
                  </label>
                  <button
                    type="submit"
                    className="button button-outline button-small"
                    disabled={busy || refreshing}
                  >
                    Salvar texto corrigido
                  </button>
                </form>
              </details>
            </>
          ) : (
            <p>
              Relato preservado como material candidato. Não avaliamos este relato como se fosse o
              currículo enviado.
            </p>
          )}
        </article>
      ))}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

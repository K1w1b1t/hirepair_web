'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listCompletedResumes,
  readCompletedResume,
  type CompletedResume,
} from '../conversa/_lib/completed-resumes';
import { contactLine } from '../conversa/_lib/resume-presentation';
import { PdfExport } from '../conversa/_components/pdf-export';
export function ResumeLibrary({ id }: { id?: string }) {
  const [items, setItems] = useState<CompletedResume[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void (
      id ? readCompletedResume(id).then((item) => (item ? [item] : [])) : listCompletedResumes()
    )
      .then((value) => {
        if (live) {
          setItems(value);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (live)
          setError('Não foi possível abrir seus currículos neste navegador. Tente novamente.');
      });
    return () => {
      live = false;
    };
  }, [id]);
  const item = id ? items[0] : undefined;
  return (
    <main className="resume-library">
      <header className="library-header">
        <Link href="/" className="library-brand">
          hire<span>pair</span>
        </Link>
        {!id && (
          <Link className="button button-outline" href="/">
            Voltar para home
          </Link>
        )}
      </header>
      <section className="library-content">
        <p className="section-kicker">Sua próxima oportunidade começa aqui</p>
        <h1>{id ? 'Currículo aprovado' : 'Meus currículos'}</h1>
        <p>Seus currículos ficam salvos neste navegador, neste aparelho.</p>
        {error ? (
          <p role="alert">{error}</p>
        ) : !loaded ? (
          <p role="status">Abrindo seus currículos…</p>
        ) : item ? (
          <>
            <PdfExport artifact={item.artifact} />
            <article className="sr-only" aria-label="Versão textual do currículo">
              <header>
                <h2>{item.profile.name}</h2>
                <p>{item.profile.professionalTitle}</p>
                <p>{contactLine(item.profile)}</p>
              </header>
              {item.document.sections.map((section) => (
                <section key={section.id}>
                  <h2>{section.title}</h2>
                  {section.units.map((unit) => (
                    <p key={unit.id}>{unit.text}</p>
                  ))}
                </section>
              ))}
            </article>
          </>
        ) : id ? (
          <p role="alert">
            Este currículo não foi encontrado neste navegador.{' '}
            <Link href="/meus-curriculos">Voltar para Meus currículos</Link>
          </p>
        ) : (
          <>
            {items.length ? (
              <ul className="resume-list">
                {items.map((resume) => (
                  <li key={resume.id}>
                    <Link href={`/meus-curriculos/${encodeURIComponent(resume.id)}`}>
                      <span className="resume-list-icon" aria-hidden="true">
                        ▤
                      </span>
                      <span>
                        <strong>{resume.title}</strong>
                        <span>
                          Aprovado em {new Date(resume.approvedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="library-empty">
                <span aria-hidden="true">▤</span>
                <h2>Seu próximo passo começa com um currículo</h2>
                <p>Você ainda não tem currículos aprovados. Vamos criar o primeiro juntos?</p>
              </div>
            )}
            <Link className="button button-primary" href="/conversa">
              Criar meu currículo
            </Link>
          </>
        )}
      </section>
    </main>
  );
}

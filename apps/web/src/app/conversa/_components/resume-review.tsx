'use client';
import { useEffect, useRef, useState } from 'react';
import {
  applyCommand,
  canWrite,
  manualResumeFacts,
  approveResume,
  writingAuthorization,
  type Session,
  type ResumeSection,
} from '@hirepair/interview-engine';
import { saveLocalDraft } from '../_lib/journey-progress';
import { useRetainedDraft } from './use-retained-draft';
import type { ExportArtifact } from '../_lib/pdf-contract';
import { completeResume } from '../_lib/completed-resumes';
import { cleanupJourney } from '../_lib/cleanup-journey';
import { contactLine, PROFILE_FIELDS, resumeBlocks } from '../_lib/resume-presentation';
import { PdfPreview } from './pdf-preview';
import { PdfExport } from './pdf-export';
import { TurnstileChallenge } from './turnstile-challenge';
import {
  generateResume,
  hasInterviewAccess,
  authorizeResume,
  type GuestChallenge,
} from '../_lib/guest-api';
import { commitInterview, hashValue } from '../_lib/interview-session';
import { readHeaderProfile, type HeaderProfile } from '../_lib/engine-storage';
import { captureAnalyticsEvent } from '../../../analytics/analytics';
import type { JobDraft } from '../_lib/job-analysis';
const emptyProfile: HeaderProfile = { name: '', email: '', phone: '', confirmed: false };
export function ResumeReview({
  session,
  draft,
  onChange,
}: Readonly<{
  session: Session;
  draft: JobDraft;
  onChange: (session: Session) => void;
}>) {
  const [archived, setArchived] = useState(false);
  const [artifact, setArtifact] = useState<ExportArtifact>();
  const [exportError, setExportError] = useState('');
  const [challenge, setChallenge] = useState<GuestChallenge>();
  const [profile, setProfile] = useState(emptyProfile);
  const [profileReady, setProfileReady] = useState(false);
  const [requestedEditing, setEditing, editorError] = useRetainedDraft<
    ResumeSection | 'profile' | null
  >('review-editor', null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const writing = session.writing;
  const editable = writing?.status === 'review';
  const editing = editable ? requestedEditing : null;
  const profileName = profile.name || (editable ? 'Nome e contatos' : '');
  const currentAuthorization =
    !writing?.authorization || writing.authorization === writingAuthorization(session);
  useEffect(() => {
    heading.current?.focus();
  }, [editing, writing?.status]);
  useEffect(() => {
    let live = true;
    void readHeaderProfile()
      .then((value) => {
        if (live) {
          setProfile({
            ...(value ?? emptyProfile),
            professionalTitle: value?.professionalTitle ?? draft.targetRole,
          });
          setProfileReady(true);
        }
      })
      .catch(() => {
        if (live) setError('Não foi possível abrir seus contatos. Reabra a página.');
      });
    return () => {
      live = false;
    };
  }, [draft.targetRole]);
  useEffect(() => {
    let live = true;
    setArtifact(undefined);
    setExportError('');
    if (!writing?.draft || !profileReady || editing) return;
    void import('../_lib/render-pdf')
      .then(({ renderPdf }) =>
        renderPdf({
          document: writing.draft!,
          profile,
          archetype: session.strategy?.archetype ?? 'A_FIRST_JOB',
        }),
      )
      .then((value) => {
        if (live) setArtifact(value);
      })
      .catch((error) => {
        if (live)
          setExportError(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.');
      });
    return () => {
      live = false;
    };
  }, [writing?.draft, profile, profileReady, editing, session.strategy?.archetype]);
  async function commit(next: Session, confirmedProfile?: HeaderProfile) {
    const saved = await commitInterview(session, next.writing, () => next, confirmedProfile);
    onChange(saved);
    return saved;
  }
  async function generate() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    let pending: Session | undefined;
    try {
      if (!hasInterviewAccess()) {
        if (!challenge) throw new Error('ACCESS_REQUIRED');
        await authorizeResume(draft, challenge);
        setChallenge(undefined);
      }
      const inputHash = await hashValue({
        inputs: session.inputs,
        selection: session.selection,
        confirmation: session.confirmation,
        strategy: session.strategy,
      });
      pending = await commit({
        ...session,
        writing: {
          status: 'pending',
          authorization: writingAuthorization(session),
          key: crypto.randomUUID(),
          inputHash,
          original: null,
          draft: null,
          approval: null,
        },
      });
      const content = await generateResume(
        pending,
        draft.targetRole || 'Objetivo profissional',
        pending.writing!.key,
      );
      if ('kind' in content) {
        const partial = await commitInterview(pending, content, (current) => ({
          ...current,
          writing: { ...current.writing!, status: 'failed' },
          guided: current.guided ? { ...current.guided, status: 'partial' } : undefined,
          pending: [
            ...current.pending,
            {
              id: 'writing-evidence',
              criterionId: null,
              factIds: current.facts.map((fact) => fact.id),
              reason: content.reason,
              blocking: true,
            },
          ],
          interruption: { kind: 'partial', reason: content.reason, resumePhase: 'interview' },
        }));
        onChange(partial);
        return;
      }
      const next = await commitInterview(pending, content, (current) => ({
        ...current,
        phase: 'writing',
        writing: { ...current.writing!, status: 'review', original: content, draft: content },
      }));
      onChange(next);
      captureAnalyticsEvent('resume_generated', { funnel_session_id: next.funnelSessionId });
    } catch {
      setError(
        'Não foi possível concluir a redação. Sua história está salva. Não faremos outra chamada automaticamente.',
      );
      if (pending) {
        try {
          const failed = await commitInterview(pending, 'writing-failed', (current) => ({
            ...current,
            writing: { ...current.writing!, status: 'failed' },
          }));
          onChange(failed);
        } catch {
          setError(
            'Não foi possível salvar o resultado. Reabra a página para conferir o estado salvo.',
          );
        }
      }
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function saveSection(section: ResumeSection | null) {
    const document = writing!.draft!;
    const sectionId = (editing as ResumeSection).id;
    const sections = document.sections.filter((item) => item.id !== sectionId);
    const index = document.sections.findIndex((item) => item.id === sectionId);
    if (section) sections.splice(index < 0 ? sections.length : index, 0, section);
    setBusy(true);
    setError('');
    try {
      await commit({
        ...session,
        writing: {
          ...writing!,
          status: 'review',
          approval: null,
          manualFacts: manualResumeFacts({ ...document, sections }),
          draft: { ...document, sections },
        },
      });
      await Promise.all([
        saveLocalDraft(`section-title:${sectionId}`, null),
        saveLocalDraft(`section-text:${sectionId}`, null),
      ]);
      setEditing(null);
    } catch {
      setError('Não foi possível salvar. Suas alterações continuam abertas.');
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const hash = await hashValue(writing!.draft),
        profileHash = await hashValue({ ...profile, confirmed: true });
      const approved = approveResume(
        session,
        { hash, profileHash, approvedAt: Date.now() },
        profileReady,
      );
      if (artifact!.contentHash !== hash || artifact!.profileHash !== profileHash)
        throw new Error('STALE_ARTIFACT');
      const saved = applyCommand(
        session,
        crypto.randomUUID(),
        await hashValue({ hash, profileHash, fileHash: artifact!.fileHash }),
        session.revision,
        () => approved,
      );
      await completeResume(
        {
          id: saved.id,
          title: profile.professionalTitle || draft.targetRole || 'Meu currículo',
          approvedAt: saved.writing!.approval!.approvedAt,
          document: saved.writing!.draft!,
          profile: { ...profile, confirmed: true },
          session: saved,
          artifact: artifact!,
        },
        session.revision,
      );
      onChange(saved);
      setArchived(true);
      await cleanupJourney();
      window.location.replace(`/meus-curriculos/${encodeURIComponent(saved.id)}`);
    } catch {
      setError('Não foi possível aprovar. Tente salvar novamente.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="resume-review" aria-busy={busy}>
      <h1 ref={heading} tabIndex={-1}>
        {editing
          ? 'Editar seção'
          : writing?.status === 'approved'
            ? 'Currículo aprovado'
            : 'Confira seu currículo'}
      </h1>
      {(error || editorError) && <p role="alert">{error || editorError}</p>}
      {exportError && <p role="alert">{exportError}</p>}
      {writing?.draft && !editing && !artifact && !exportError && (
        <p role="status">Preparando o arquivo PDF…</p>
      )}
      {writing?.status === 'approved' &&
        artifact &&
        (archived ? <PdfExport artifact={artifact} /> : <PdfPreview blob={artifact.blob} />)}
      {!currentAuthorization && (
        <p role="alert">
          As informações usadas neste currículo mudaram. Revise os fatos e as afirmações dependentes
          antes de aprovar uma nova versão.
        </p>
      )}
      {!writing && !hasInterviewAccess() && <TurnstileChallenge onReady={setChallenge} />}
      {!writing && (
        <>
          <p>Vamos transformar sua história em um currículo direcionado à vaga.</p>
          <button
            className="button button-primary"
            disabled={busy || !canWrite(session) || (!hasInterviewAccess() && !challenge)}
            onClick={() => void generate()}
          >
            Preparar meu currículo
          </button>
        </>
      )}
      {writing?.status === 'pending' && (
        <p role="status">
          {busy
            ? 'Estamos escrevendo seu currículo…'
            : 'A redação foi iniciada. Se a resposta foi perdida, ela não pode ser recuperada neste aparelho. Sua história permanece salva.'}
        </p>
      )}
      {writing?.status === 'failed' && (
        <p>Não conseguimos concluir uma versão válida. Sua história permanece salva.</p>
      )}
      {writing?.draft &&
        (editing === 'profile' ? (
          <ProfileEditor
            profile={profile}
            busy={busy}
            onCancel={() => {
              void saveLocalDraft('profile-editor', null).catch(() =>
                setError('Não foi possível descartar o rascunho.'),
              );
              setEditing(null);
            }}
            onSave={async (value) => {
              setBusy(true);
              setError('');
              try {
                await commit(
                  {
                    ...session,
                    writing: { ...writing, status: 'review', approval: null },
                  },
                  value,
                );
                setProfile(value);
                await saveLocalDraft('profile-editor', null);
                setEditing(null);
              } catch {
                setError('Não foi possível salvar seus contatos.');
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : editing ? (
          <SectionEditor
            key={editing.id}
            section={editing}
            busy={busy}
            onCancel={() => {
              const id = (editing as ResumeSection).id;
              void Promise.all([
                saveLocalDraft(`section-title:${id}`, null),
                saveLocalDraft(`section-text:${id}`, null),
              ]).catch(() => setError('Não foi possível descartar o rascunho.'));
              setEditing(null);
            }}
            onSave={(value) => void saveSection(value)}
          />
        ) : (
          <>
            <p>
              {writing.status === 'approved'
                ? 'Você concluiu a revisão. Seu currículo está salvo neste aparelho.'
                : 'Use o botão Editar de cada seção para ajustar o texto. Ao aprovar o currículo, você confirma todas as informações, incluindo suas alterações.'}
            </p>
            <article className={editable ? 'resume-document' : 'sr-only'} aria-label="Currículo">
              <header className="resume-edit-block resume-document-header">
                <div className="resume-section-heading">
                  {profileName && <strong className="resume-name">{profileName}</strong>}
                  {editable && (
                    <button
                      type="button"
                      className="resume-edit-button"
                      onClick={() => setEditing('profile')}
                      disabled={!profileReady}
                      aria-label="Editar nome e contatos"
                    >
                      Editar
                    </button>
                  )}
                </div>
                {profile.professionalTitle && (
                  <p className="resume-professional-title">{profile.professionalTitle}</p>
                )}
                <p className="resume-contacts">{contactLine(profile)}</p>
              </header>
              {resumeBlocks(writing.draft.sections).map(({ section, areaTitle, isExperience }) => (
                <section
                  key={section.id}
                  className={`resume-edit-block ${isExperience ? 'resume-experience' : 'resume-area'}`}
                >
                  {areaTitle && <h2 className="resume-area-title">{areaTitle}</h2>}
                  <div className="resume-section-heading">
                    {isExperience ? <h3>{section.title}</h3> : <h2>{section.title}</h2>}
                    {editable && (
                      <button
                        type="button"
                        className="resume-edit-button"
                        aria-label={`Editar ${section.title}`}
                        onClick={() => setEditing(structuredClone(section))}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                  {section.units.map((unit) => (
                    <p key={unit.id} className={isExperience ? 'resume-bullet' : undefined}>
                      {unit.text}
                    </p>
                  ))}
                </section>
              ))}
            </article>
            {(editable || (writing.status === 'approved' && !archived)) && (
              <>
                {editable && (
                  <button
                    className="button button-outline"
                    onClick={() =>
                      setEditing({
                        id: crypto.randomUUID(),
                        title: '',
                        experienceId: null,
                        units: [],
                      })
                    }
                  >
                    Adicionar seção
                  </button>
                )}
                <button
                  className="button button-primary"
                  disabled={
                    busy ||
                    !artifact ||
                    !profileReady ||
                    !writing.draft.sections.length ||
                    !canWrite(session) ||
                    !currentAuthorization
                  }
                  onClick={() => void approve()}
                >
                  {writing.status === 'approved' ? 'Aprovar PDF e salvar' : 'Aprovar currículo'}
                </button>
              </>
            )}
          </>
        ))}
    </section>
  );
}
export function ProfileEditor({
  profile,
  busy,
  onSave,
  onCancel,
}: Readonly<{
  profile: HeaderProfile;
  busy: boolean;
  onSave: (profile: HeaderProfile) => Promise<void>;
  onCancel: () => void;
}>) {
  const [value, setValue, draftError] = useRetainedDraft('profile-editor', profile);
  return (
    <form
      className="resume-section-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ ...value, confirmed: false });
      }}
    >
      <p className="resume-editor-context">Cabeçalho do currículo</p>
      {draftError && <p role="alert">{draftError}</p>}
      <p>Nome e contatos ficam neste aparelho e não são enviados à IA.</p>
      {PROFILE_FIELDS.map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            maxLength={200}
            value={value[key] ?? ''}
            onChange={(event) => setValue({ ...value, [key]: event.target.value })}
          />
        </label>
      ))}
      <button type="submit" disabled={busy} className="button button-primary">
        Salvar alterações
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
}
export function SectionEditor({
  section,
  busy,
  onSave,
  onCancel,
}: Readonly<{
  section: ResumeSection;
  busy: boolean;
  onSave: (section: ResumeSection | null) => void;
  onCancel: () => void;
}>) {
  const [title, setTitle, titleError] = useRetainedDraft(
    `section-title:${section.id}`,
    section.title,
  );
  const [text, setText, textError] = useRetainedDraft(
    `section-text:${section.id}`,
    section.units.map((unit) => unit.text).join('\n'),
  );
  return (
    <form
      className="resume-section-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...section,
          title: title.trim(),
          units: text
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, index) => {
              const old = section.units[index];
              return old?.text === line
                ? old
                : { id: crypto.randomUUID(), text: line, factIds: [], criterionIds: [] };
            }),
        });
      }}
    >
      <p className="resume-editor-context">Seção do currículo</p>
      {(titleError || textError) && <p role="alert">{titleError || textError}</p>}
      <label htmlFor="resume-section-title">
        Título da seção{' '}
        <input
          id="resume-section-title"
          required
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label htmlFor="resume-section-content">
        Conteúdo{' '}
        <textarea
          id="resume-section-content"
          required
          maxLength={6000}
          rows={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <p>Use uma linha para cada item.</p>
      <button
        type="submit"
        className="button button-primary"
        disabled={busy || !title.trim() || !text.trim()}
      >
        Salvar alterações
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancelar
      </button>
      <button type="button" disabled={busy} onClick={() => onSave(null)}>
        Remover seção
      </button>
    </form>
  );
}

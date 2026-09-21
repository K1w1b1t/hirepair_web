'use client';
import { useEffect, useState } from 'react';
import { clearStoredResumes, type StoredResume } from '../_lib/resume-storage';
import {
  archetypes,
  objectives,
  tones,
  type Archetype,
  type Objective,
  type Tone,
} from '../_lib/job-analysis';

type Result = {
  targetRole: string;
  summary: string;
  requirements: Array<{ text: string; category: string }>;
  suggestedArchetype: Archetype;
  suggestedObjective: Objective;
  suggestedTone: Tone;
  reason: string;
};
const ANALYSIS_KEY = 'hirepair_job_analysis';
function visitorId() {
  const key = 'hirepair_guest_id';
  const current = localStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}
function Choice<T extends string>({
  title,
  values,
  value,
  onChange,
}: {
  title: string;
  values: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="job-choice">
      <legend>{title}</legend>
      <div>
        {values.map((item) => (
          <label key={item.value}>
            <input
              checked={value === item.value}
              name={title}
              onChange={() => onChange(item.value)}
              type="radio"
              value={item.value}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function JobExampleStep({ documents }: { documents: StoredResume[] }) {
  const [hasJob, setHasJob] = useState(true);
  const [jobText, setJobText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [archetype, setArchetype] = useState<Archetype>('D_SAME_FIELD_RETURN');
  const [objective, setObjective] = useState<Objective>('ENTER_FAST');
  const [tone, setTone] = useState<Tone>('NEUTRAL');
  useEffect(() => {
    const saved = localStorage.getItem(ANALYSIS_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        result: Result;
        archetype: Archetype;
        objective: Objective;
        tone: Tone;
      };
      setResult(parsed.result);
      setArchetype(parsed.archetype);
      setObjective(parsed.objective);
      setTone(parsed.tone);
    } catch {
      localStorage.removeItem(ANALYSIS_KEY);
    }
  }, []);
  useEffect(() => {
    if (result)
      localStorage.setItem(ANALYSIS_KEY, JSON.stringify({ result, archetype, objective, tone }));
  }, [archetype, objective, result, tone]);
  const analyze = async () => {
    setLoading(true);
    setError('');
    try {
      const root = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const visitor = visitorId();
      const access = await fetch(`${root}/guest/access`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visitorId: visitor, acceptedTerms: true, acceptedPrivacy: true }),
      });
      if (!access.ok) throw new Error('Não foi possível iniciar sua jornada.');
      const token = ((await access.json()) as { accessToken: string }).accessToken;
      const response = await fetch(`${root}/guest/job-analysis`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          documents: documents.map(({ id, text }) => ({ id, text })),
          ...(hasJob ? { jobText } : { targetRole }),
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Sua análise gratuita volta em até 24 horas.'
            : 'A análise está indisponível. Tente novamente.',
        );
      const next = (await response.json()) as Result;
      setResult(next);
      setArchetype(next.suggestedArchetype);
      setObjective(next.suggestedObjective);
      setTone(next.suggestedTone);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'A análise está indisponível.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="job-example-step">
      <p className="section-kicker">Etapa 2 · seu próximo passo</p>
      <h1>Você tem uma vaga de exemplo?</h1>
      <p>Cole os requisitos e a gente sugere a melhor forma de apresentar sua experiência.</p>
      <div className="job-toggle">
        <button aria-pressed={hasJob} onClick={() => setHasJob(true)} type="button">
          Tenho uma vaga
        </button>
        <button aria-pressed={!hasJob} onClick={() => setHasJob(false)} type="button">
          Ainda não tenho
        </button>
      </div>
      {hasJob ? (
        <textarea
          aria-label="Requisitos da vaga"
          onChange={(event) => setJobText(event.target.value)}
          placeholder="Cole aqui a descrição ou os requisitos da vaga"
          rows={7}
          value={jobText}
        />
      ) : (
        <input
          aria-label="Cargo que procura"
          onChange={(event) => setTargetRole(event.target.value)}
          placeholder="Qual cargo você quer buscar?"
          value={targetRole}
        />
      )}
      <label className="job-terms">
        <input
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          type="checkbox"
        />{' '}
        Li e aceito os <a href="/legal#terms">Termos</a> e a{' '}
        <a href="/legal#privacy">Política de Privacidade</a>. A análise usa IA para prestar este
        serviço.
      </label>
      <button
        className="button button-primary"
        disabled={loading || !accepted || (hasJob ? !jobText.trim() : !targetRole.trim())}
        onClick={() => void analyze()}
        type="button"
      >
        {loading ? 'Analisando…' : 'Analisar e sugerir'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {result ? (
        <div className="job-result">
          <p className="section-kicker">Sugerido para você</p>
          <h2>{result.targetRole}</h2>
          <p>{result.reason}</p>
          <p>{result.summary}</p>
          {result.requirements.length ? (
            <ul>
              {result.requirements.map((item) => (
                <li key={item.text}>{item.text}</li>
              ))}
            </ul>
          ) : null}
          <Choice
            title="Estrutura do currículo"
            values={archetypes}
            value={archetype}
            onChange={setArchetype}
          />
          <Choice
            title="Seu objetivo"
            values={objectives}
            value={objective}
            onChange={setObjective}
          />
          <Choice title="Tom de escrita" values={tones} value={tone} onChange={setTone} />
          <button
            className="button button-outline button-small"
            onClick={() => {
              localStorage.removeItem(ANALYSIS_KEY);
              void clearStoredResumes();
              setResult(undefined);
            }}
            type="button"
          >
            Apagar meus dados deste navegador
          </button>
        </div>
      ) : null}
    </section>
  );
}

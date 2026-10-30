import { diagnoseStoredDocuments, type DiagnosticMaterial } from './diagnostic';
import {
  createSession,
  attachDiagnostics,
  replan,
  mergeHistory,
  interrupt,
  validatePreparation,
  type PreparationResult,
  type Session,
} from '@hirepair/interview-engine';
import { readEngine, saveEngine } from './engine-storage';
import type { JobAnalysisResult, JobDraft } from './job-analysis';
import { archetypes, objectives, tones } from './job-analysis';
import { sanitizeMaterial } from './sanitize-material';
import { readBrowserValue, removeBrowserValue, writeBrowserValue } from './browser-storage';

export interface GuestChallenge {
  token: string;
  termsVersion: string;
  privacyVersion: string;
}
export const apiRoot = () =>
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
export const GUEST_CREDENTIAL_KEY = 'hirepair_guest_credential';
let generation = 0;
let controller: AbortController | null = null;
export function cancelPreparation(): void {
  generation++;
  controller?.abort();
}
const PENDING_KEY = 'hirepair_analysis_pending';
export const ANALYSIS_MESSAGES: Record<string, string> = {
  LOCAL_STORAGE_UNAVAILABLE:
    'Não foi possível salvar a jornada neste aparelho. A retomada não está garantida.',
  REVISION_CONFLICT: 'Esta jornada mudou em outra aba. Reabra para usar a versão atual.',
  REQUEST_CANCELLED: 'A preparação foi interrompida.',
  AI_INPUT_TOO_LARGE: 'Reduza os materiais e os requisitos da vaga para analisar.',
  VALIDATION_ERROR: 'Revise os materiais e os requisitos da vaga.',
  ANALYSIS_MATERIAL_EMPTY: 'Adicione material com texto antes de analisar.',
  ANALYSIS_TARGET_EMPTY: 'Informe os requisitos da vaga ou o cargo desejado.',
  GUEST_ANALYSIS_LIMIT_REACHED:
    'Você usou suas três análises nesta semana. Tente novamente após a renovação da cota.',
  NETWORK_LIMIT_REACHED: 'Houve muitos pedidos nesta rede. Aguarde um pouco e tente novamente.',
  RATE_LIMIT_REACHED: 'Houve muitos pedidos. Aguarde um pouco e tente novamente.',
  AI_CAPACITY_EXHAUSTED: 'A capacidade gratuita da IA foi atingida. Tente novamente mais tarde.',
  AI_DISABLED: 'A análise está temporariamente indisponível.',
  AI_UNAVAILABLE: 'A análise está temporariamente indisponível.',
  AI_CONFIGURATION_ERROR: 'A análise está temporariamente indisponível.',
  OPERATIONAL_STORAGE_UNAVAILABLE: 'A análise está temporariamente indisponível.',
  AI_REQUEST_REJECTED:
    'Não foi possível analisar este conteúdo. Revise os materiais e tente novamente.',
  AI_INVALID_RESPONSE: 'Não foi possível confirmar a análise. Tente novamente.',
  GUEST_ACCESS_INVALID:
    'Verifique seu acesso novamente para continuar. Seus materiais foram preservados.',
  CONSENT_REQUIRED: 'Leia e aceite a versão atual dos Termos e da Política de Privacidade.',
  TURNSTILE_INVALID: 'Verifique seu acesso novamente para continuar.',
  TURNSTILE_UNAVAILABLE: 'A verificação de acesso está temporariamente indisponível.',
  ANALYSIS_IN_PROGRESS: 'Sua análise já está em andamento. Aguarde antes de tentar novamente.',
  ANALYSIS_ALREADY_PROCESSED:
    'Este pedido já foi processado. Confira suas sugestões salvas ou faça uma nova análise.',
  IDEMPOTENCY_CONFLICT: 'Este pedido mudou. Tente novamente para iniciar uma nova análise.',
};
export class AnalysisFailure extends Error {
  constructor(readonly code: string) {
    super(ANALYSIS_MESSAGES[code] ?? 'Não foi possível analisar agora. Tente novamente.');
  }
}
export function isJobAnalysisResult(value: unknown): value is JobAnalysisResult {
  if (!value || typeof value !== 'object') return false;
  const item = value as JobAnalysisResult;
  return (
    typeof item.targetRole === 'string' &&
    typeof item.reason === 'string' &&
    typeof item.summary === 'string' &&
    archetypes.some(({ value }) => value === item.suggestedArchetype) &&
    objectives.some(({ value }) => value === item.suggestedObjective) &&
    tones.some(({ value }) => value === item.suggestedTone) &&
    Array.isArray(item.requirements) &&
    item.requirements.every(
      (requirement) =>
        requirement &&
        typeof requirement.text === 'string' &&
        typeof requirement.category === 'string',
    )
  );
}
export async function inputFingerprint(
  documents: Array<{ id: string; text: string }>,
  draft: JobDraft,
): Promise<string> {
  const input = JSON.stringify({
    version: 2,
    ...(draft.objective ? { objective: draft.objective, provisional: !!draft.provisional } : {}),
    documents: documents.map(({ id, text }) => ({ id, text })),
    hasJob: draft.hasJob,
    target: draft.hasJob ? draft.jobText : draft.targetRole,
  });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function requireResponse(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const code =
      payload &&
      typeof payload === 'object' &&
      'code' in payload &&
      typeof payload.code === 'string'
        ? payload.code
        : 'UNKNOWN';
    if (code === 'GUEST_ACCESS_INVALID') removeBrowserValue(GUEST_CREDENTIAL_KEY);
    if (code !== 'ANALYSIS_IN_PROGRESS') removeBrowserValue(PENDING_KEY);
    throw new AnalysisFailure(code);
  }
  return payload;
}
function pendingKey(fingerprint: string): string {
  let pending: { hash: string; key: string } | undefined;
  try {
    pending = JSON.parse(readBrowserValue(PENDING_KEY) ?? 'null') as typeof pending;
  } catch {
    pending = undefined;
  }
  const key =
    pending?.hash === fingerprint && typeof pending.key === 'string'
      ? pending.key
      : crypto.randomUUID();
  writeBrowserValue(PENDING_KEY, JSON.stringify({ hash: fingerprint, key }));
  return key;
}
async function persistInterruption(
  error: unknown,
  draft: JobDraft,
  currentGeneration: number,
  sessionId: string,
): Promise<void> {
  if (draft.objective && currentGeneration === generation && error instanceof AnalysisFailure) {
    try {
      const active = await readEngine();
      if (active?.id === sessionId) {
        const kind = ['AI_CAPACITY_EXHAUSTED', 'GUEST_ANALYSIS_LIMIT_REACHED'].includes(error.code)
          ? 'budget_exhausted'
          : 'paused';
        await saveEngine(
          { ...interrupt(active, kind, error.code), revision: active.revision + 1 },
          active.revision,
        );
      }
    } catch {
      /* Preserve the original safe error; no successful persistence is claimed. */
    }
  }
}
async function storePreparation(
  result: unknown,
  draft: JobDraft,
  previous: Session | null,
  sessionId: string,
  funnelSessionId: string,
  documents: DiagnosticMaterial[],
  currentGeneration: number,
): Promise<JobAnalysisResult> {
  try {
    validatePreparation(result, sanitizeMaterial(draft.hasJob ? draft.jobText : ''));
  } catch {
    throw new AnalysisFailure('AI_INVALID_RESPONSE');
  }
  const prepared = result as PreparationResult;
  if (
    prepared.session.id !== sessionId ||
    prepared.session.funnelSessionId !== funnelSessionId ||
    prepared.session.objective!.value !== draft.objective
  )
    throw new AnalysisFailure('AI_INVALID_RESPONSE');
  let session = prepared.session;
  if (previous) {
    session = mergeHistory(previous, session);
    const factHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(session.facts)),
    );
    session.inputs.facts = Array.from(new Uint8Array(factHash), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    session.plan = replan(session);
    session.strategy!.inputs = { ...session.inputs };
  }
  const reports = await diagnoseStoredDocuments(
    documents,
    draft.hasJob ? draft.jobText : draft.targetRole,
    session.strategy!.archetype,
    session,
  );
  if (currentGeneration !== generation) throw new AnalysisFailure('REQUEST_CANCELLED');
  session = attachDiagnostics(
    {
      ...session,
      diagnostics: previous?.diagnostics,
      pending: [
        ...session.pending,
        ...(previous?.pending ?? []).filter((p) => p.diagnosticFindingId),
      ],
    },
    reports,
  );
  session.plan = replan(session);
  session.revision = (previous?.revision ?? 0) + 1;
  await saveEngine(session, previous?.revision ?? 0);
  sessionStorage.setItem('hirepair_funnel_session_id', session.funnelSessionId);
  writeBrowserValue('hirepair_engine_funnel', session.funnelSessionId);
  const strategy = session.strategy!;
  removeBrowserValue(PENDING_KEY);
  return {
    preparation: session,
    targetRole: draft.targetRole || 'Sua próxima vaga',
    summary: 'Sua conversa está preparada. Vamos conhecer melhor sua experiência.',
    requirements: session.criteria.map(({ text, category }) => ({ text, category })),
    suggestedArchetype: strategy.archetype,
    suggestedObjective: draft.objective!,
    suggestedTone: strategy.tone,
    reason: strategy.reason,
  };
}
async function guestAccess(
  draft: JobDraft,
  challenge: GuestChallenge,
): Promise<{ accessToken: string }> {
  const credential = readBrowserValue(GUEST_CREDENTIAL_KEY);
  const access = await requireResponse(
    await fetch(`${apiRoot()}/guest/access`, {
      method: 'POST',
      ...(draft.objective ? { signal: controller!.signal } : {}),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(credential ? { guestCredential: credential } : {}),
        turnstileToken: challenge.token,
        acceptedTerms: draft.accepted,
        acceptedPrivacy: draft.accepted,
        termsVersion: challenge.termsVersion,
        privacyVersion: challenge.privacyVersion,
      }),
    }),
  );
  if (
    !access ||
    typeof access !== 'object' ||
    !('accessToken' in access) ||
    typeof access.accessToken !== 'string'
  )
    throw new AnalysisFailure('GUEST_ACCESS_INVALID');
  if ('guestCredential' in access && typeof access.guestCredential === 'string')
    writeBrowserValue(GUEST_CREDENTIAL_KEY, access.guestCredential);
  return { accessToken: access.accessToken };
}
async function requestAnalysis(
  documents: Array<{ id: string; text: string }>,
  draft: JobDraft,
  sessionId: string,
  funnelSessionId: string,
  accessToken: string,
  key: string,
): Promise<Response> {
  return fetch(`${apiRoot()}/guest/${draft.objective ? 'interview-preparation' : 'job-analysis'}`, {
    method: 'POST',
    ...(draft.objective ? { signal: controller!.signal } : {}),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      'Idempotency-Key': key,
    },
    body: JSON.stringify({
      ...(draft.objective
        ? {
            version: 1,
            sessionId,
            funnelSessionId,
            objective: draft.objective,
            provisional: !!draft.provisional,
          }
        : {}),
      documents: documents.map(({ id, text }) => ({ id, text: sanitizeMaterial(text) })),
      ...(draft.hasJob
        ? { jobText: sanitizeMaterial(draft.jobText) }
        : { targetRole: sanitizeMaterial(draft.targetRole) }),
    }),
  });
}
export async function analyzeGuest(
  documents: DiagnosticMaterial[],
  draft: JobDraft,
  challenge: GuestChallenge,
): Promise<JobAnalysisResult> {
  const currentGeneration = generation;
  if (draft.objective) controller = new AbortController();
  if (!draft.accepted) throw new AnalysisFailure('CONSENT_REQUIRED');
  const size =
    documents.reduce((sum, { text }) => sum + text.length, 0) +
    (draft.hasJob ? draft.jobText.length : draft.targetRole.length);
  if (size > 20_000) throw new AnalysisFailure('AI_INPUT_TOO_LARGE');
  const fingerprint = await inputFingerprint(documents, draft);
  const key = pendingKey(fingerprint);
  const access = await guestAccess(draft, challenge);
  if (currentGeneration !== generation) throw new AnalysisFailure('REQUEST_CANCELLED');
  const previous = draft.objective ? await readEngine() : null;
  if (currentGeneration !== generation) throw new AnalysisFailure('REQUEST_CANCELLED');
  const sessionId = previous?.id ?? crypto.randomUUID();
  const funnelSessionId =
    previous?.funnelSessionId ??
    sessionStorage.getItem('hirepair_funnel_session_id') ??
    crypto.randomUUID();
  if (draft.objective && !previous) {
    const initial = createSession(sessionId, funnelSessionId, {
      resumes: '',
      job: '',
      objective: '',
      facts: '',
    });
    await saveEngine(initial, null);
    writeBrowserValue('hirepair_engine_funnel', funnelSessionId);
  }
  const result = await requireResponse(
    await requestAnalysis(documents, draft, sessionId, funnelSessionId, access.accessToken, key),
  ).catch(async (error: unknown) => {
    await persistInterruption(error, draft, currentGeneration, sessionId);
    throw error;
  });
  if (currentGeneration !== generation) throw new AnalysisFailure('REQUEST_CANCELLED');
  if (draft.objective) {
    return storePreparation(
      result,
      draft,
      previous,
      sessionId,
      funnelSessionId,
      documents,
      currentGeneration,
    );
  }
  if (!isJobAnalysisResult(result)) throw new AnalysisFailure('AI_INVALID_RESPONSE');
  removeBrowserValue(PENDING_KEY);
  return result;
}

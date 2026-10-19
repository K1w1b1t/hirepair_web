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
const PENDING_KEY = 'hirepair_analysis_pending';
export const ANALYSIS_MESSAGES: Record<string, string> = {
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
export async function analyzeGuest(
  documents: Array<{ id: string; text: string }>,
  draft: JobDraft,
  challenge: GuestChallenge,
): Promise<JobAnalysisResult> {
  if (!draft.accepted) throw new AnalysisFailure('CONSENT_REQUIRED');
  const size =
    documents.reduce((sum, { text }) => sum + text.length, 0) +
    (draft.hasJob ? draft.jobText.length : draft.targetRole.length);
  if (size > 20_000) throw new AnalysisFailure('AI_INPUT_TOO_LARGE');
  const fingerprint = await inputFingerprint(documents, draft);
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
  const credential = readBrowserValue(GUEST_CREDENTIAL_KEY);
  const access = await requireResponse(
    await fetch(`${apiRoot()}/guest/access`, {
      method: 'POST',
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
  const result = await requireResponse(
    await fetch(`${apiRoot()}/guest/job-analysis`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${access.accessToken}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        documents: documents.map(({ id, text }) => ({ id, text: sanitizeMaterial(text) })),
        ...(draft.hasJob
          ? { jobText: sanitizeMaterial(draft.jobText) }
          : { targetRole: sanitizeMaterial(draft.targetRole) }),
      }),
    }),
  );
  if (!isJobAnalysisResult(result)) throw new AnalysisFailure('AI_INVALID_RESPONSE');
  removeBrowserValue(PENDING_KEY);
  return result;
}

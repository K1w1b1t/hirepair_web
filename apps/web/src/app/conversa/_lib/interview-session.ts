import { applyCommand, type Session } from '@hirepair/interview-engine';
import { type HeaderProfile, saveEngine } from './engine-storage';
export async function hashValue(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function commitInterview(
  session: Session,
  payload: unknown,
  command: (s: Session, hash: string) => Session,
  profile?: HeaderProfile,
): Promise<Session> {
  const hash = await hashValue(payload);
  const next = applyCommand(session, crypto.randomUUID(), hash, session.revision, (value) =>
    command(value, hash),
  );
  await saveEngine(next, session.revision, profile);
  return next;
}

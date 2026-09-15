import { UserRole } from '@prisma/client';
import { RequestContextService } from './request-context.service';
import { REQUEST_CONTEXT_KEYS, SYSTEM_ACTOR_ID } from './request-context.constants';

describe('RequestContextService', () => {
  it('returns the authenticated actor and falls back to SYSTEM', () => {
    const store = {
      [REQUEST_CONTEXT_KEYS.ACTOR_ID]: 'user-1',
      [REQUEST_CONTEXT_KEYS.ACTOR_ROLE]: UserRole.CANDIDATE,
      [REQUEST_CONTEXT_KEYS.GLOBAL_TRACE_ID]: 'trace-1',
    };
    const service = new RequestContextService({
      get: (key: keyof typeof store) => store[key],
    } as never);

    expect(service.getActor()).toEqual({ actorId: 'user-1', role: UserRole.CANDIDATE });
    expect(service.getTraceId()).toBe('trace-1');
    expect(new RequestContextService({ get: () => undefined } as never).getActorId()).toBe(
      SYSTEM_ACTOR_ID,
    );
  });

  it('returns null when there is no authenticated role', () => {
    expect(new RequestContextService({ get: () => undefined } as never).getActor()).toBeNull();
  });
});

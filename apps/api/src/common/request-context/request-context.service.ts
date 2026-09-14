import { Injectable } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { REQUEST_CONTEXT_KEYS, SYSTEM_ACTOR_ID } from './request-context.constants';

export interface RequestActor {
  actorId: string;
  role: UserRole;
}

@Injectable()
export class RequestContextService {
  constructor(private readonly cls: ClsService) {}

  getActor(): RequestActor | null {
    const role = this.cls.get<UserRole | undefined>(REQUEST_CONTEXT_KEYS.ACTOR_ROLE);
    return role ? { actorId: this.getActorId(), role } : null;
  }

  getActorId(): string {
    return this.cls.get<string>(REQUEST_CONTEXT_KEYS.ACTOR_ID) ?? SYSTEM_ACTOR_ID;
  }

  getTraceId(): string | undefined {
    return this.cls.get<string | undefined>(REQUEST_CONTEXT_KEYS.GLOBAL_TRACE_ID);
  }
}

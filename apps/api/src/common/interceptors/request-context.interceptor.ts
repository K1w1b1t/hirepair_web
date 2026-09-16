import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import {
  REQUEST_CONTEXT_KEYS,
  SYSTEM_ACTOR_ID,
} from '../request-context/request-context.constants';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
      this.cls.set(REQUEST_CONTEXT_KEYS.ACTOR_ID, user?.id ?? SYSTEM_ACTOR_ID);
      if (user) this.cls.set(REQUEST_CONTEXT_KEYS.ACTOR_ROLE, user.role);
    }
    return next.handle();
  }
}

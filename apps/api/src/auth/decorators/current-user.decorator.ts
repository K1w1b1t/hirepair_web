import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    return field && user ? user[field] : user;
  },
);

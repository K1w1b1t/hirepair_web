import type { User, UserRole, UserStatus } from '@prisma/client';
import type { Request } from 'express';

export type AuthenticatedUser = Pick<User, 'id' | 'email'> & {
  role: UserRole;
  status: UserStatus;
};
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

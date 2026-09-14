import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const context = (role?: UserRole) =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    }) as never;

  it('allows routes without role metadata', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(context())).toBe(true);
  });

  it('allows an explicitly listed role and denies missing or different roles', () => {
    const reflector = { getAllAndOverride: () => [UserRole.CANDIDATE] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context(UserRole.CANDIDATE))).toBe(true);
    expect(() => guard.canActivate(context(UserRole.ADMIN))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
  });
});

import { UserRole } from '@prisma/client';
import { of } from 'rxjs';
import { RequestContextInterceptor } from './request-context.interceptor';
import {
  REQUEST_CONTEXT_KEYS,
  SYSTEM_ACTOR_ID,
} from '../request-context/request-context.constants';

describe('RequestContextInterceptor', () => {
  const set = jest.fn();
  const interceptor = new RequestContextInterceptor({ set } as never);
  const next = { handle: () => of('ok') };

  beforeEach(() => jest.clearAllMocks());

  it('stores the authenticated actor', () => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'user-1', role: UserRole.ADMIN } }),
      }),
    } as never;

    interceptor.intercept(context, next);

    expect(set).toHaveBeenCalledWith(REQUEST_CONTEXT_KEYS.ACTOR_ID, 'user-1');
    expect(set).toHaveBeenCalledWith(REQUEST_CONTEXT_KEYS.ACTOR_ROLE, UserRole.ADMIN);
  });

  it('uses SYSTEM for public HTTP requests and ignores non-http contexts', () => {
    interceptor.intercept(
      { getType: () => 'http', switchToHttp: () => ({ getRequest: () => ({}) }) } as never,
      next,
    );
    expect(set).toHaveBeenCalledWith(REQUEST_CONTEXT_KEYS.ACTOR_ID, SYSTEM_ACTOR_ID);
    jest.clearAllMocks();
    interceptor.intercept({ getType: () => 'rpc' } as never, next);
    expect(set).not.toHaveBeenCalled();
  });
});

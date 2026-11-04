import handler, { bootstrap } from './main';

jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));
jest.mock('@nestjs/core', () => ({ NestFactory: { create: jest.fn() } }));
const mockCreate = jest.requireMock<{ NestFactory: { create: jest.Mock } }>('@nestjs/core')
  .NestFactory.create;
jest.mock('./app.setup', () => ({ configureApp: jest.fn() }));

describe('Vercel handler', () => {
  it('retries a failed initialization and shares each concurrent attempt', async () => {
    const express = jest.fn();
    const app = {
      useLogger: jest.fn(),
      get: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      init: jest.fn().mockResolvedValue(undefined),
      getHttpAdapter: () => ({ getInstance: () => express }),
    };
    const error = new Error('database unavailable');
    app.init.mockRejectedValueOnce(error);
    mockCreate.mockResolvedValue(app);
    const request = {} as never;
    const response = {} as never;
    const failures = await Promise.allSettled([
      handler(request, response),
      handler(request, response),
    ]);
    expect(failures).toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(express).not.toHaveBeenCalled();
    await Promise.all([handler(request, response), handler(request, response)]);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(app.init).toHaveBeenCalledTimes(2);
    expect(express).toHaveBeenCalledTimes(2);
  });

  it('starts a listening server outside Vercel', async () => {
    const app = {
      useLogger: jest.fn(),
      get: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    mockCreate.mockResolvedValueOnce(app);
    await bootstrap();
    expect(app.listen).toHaveBeenCalledWith(process.env.PORT ?? 3001);
  });
});

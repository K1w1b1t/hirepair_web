import handler from './main';

jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));
jest.mock('@nestjs/core', () => ({ NestFactory: { create: jest.fn() } }));
const mockCreate = jest.requireMock<{ NestFactory: { create: jest.Mock } }>('@nestjs/core')
  .NestFactory.create;
jest.mock('./app.setup', () => ({ configureApp: jest.fn() }));

describe('Vercel handler', () => {
  it('initializes once for concurrent requests and forwards both requests', async () => {
    const express = jest.fn();
    const app = {
      useLogger: jest.fn(),
      get: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      init: jest.fn().mockResolvedValue(undefined),
      getHttpAdapter: () => ({ getInstance: () => express }),
    };
    mockCreate.mockResolvedValue(app);
    const request = {} as never;
    const response = {} as never;
    await Promise.all([handler(request, response), handler(request, response)]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(app.init).toHaveBeenCalledTimes(1);
    expect(express).toHaveBeenCalledTimes(2);
  });
});

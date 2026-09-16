import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { configureApp } from './app.setup';

jest.mock('helmet', () => ({ __esModule: true, default: jest.fn(() => 'helmet') }));

describe('configureApp', () => {
  const app = {
    use: jest.fn(),
    enableShutdownHooks: jest.fn(),
    enableCors: jest.fn(),
    useGlobalPipes: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('configures safe HTTP defaults and development docs', () => {
    const createDocument = jest.spyOn(SwaggerModule, 'createDocument').mockReturnValue({} as never);
    const setup = jest.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined);

    configureApp(app as never, {
      NODE_ENV: 'development',
      CORS_ORIGIN: '["https://hirepair.com.br"]',
    });

    expect(app.use).toHaveBeenCalledTimes(3);
    expect(app.enableShutdownHooks).toHaveBeenCalled();
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: ['https://hirepair.com.br'],
        credentials: true,
        exposedHeaders: ['x-global-trace-id', 'Content-Disposition'],
      }),
    );
    const [pipe] = app.useGlobalPipes.mock.lastCall as unknown as [unknown];
    expect(pipe).toBeInstanceOf(ValidationPipe);
    expect(createDocument).toHaveBeenCalledWith(app, expect.any(Object));
    expect(setup).toHaveBeenCalledWith('docs', app, {});
  });

  it('keeps docs disabled by default in production', () => {
    const setup = jest.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined);

    configureApp(app as never, { NODE_ENV: 'production' });

    expect(setup).not.toHaveBeenCalled();
  });
});

import { ConfigModule } from '@nestjs/config';
jest.mock('@nestjs/config', () => {
  const original = jest.requireActual<typeof import('@nestjs/config')>('@nestjs/config');
  return {
    ...original,
    ConfigModule: { forRoot: jest.fn(() => ({ module: class TestConfig {} })) },
  };
});
import { AppModule } from './app.module';
import { GuestModule } from './guest/guest.module';
import { MODULE_METADATA } from '@nestjs/common/constants';
it('loads business protections without starting unused queue workers', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as Array<{
    name?: string;
  }>;
  expect(imports).toContain(GuestModule);
  expect(imports.map((item) => item.name)).not.toContain('QueuesModule');
  expect(ConfigModule).toHaveProperty('forRoot');
});

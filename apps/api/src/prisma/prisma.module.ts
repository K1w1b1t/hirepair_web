import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * `@Global()` para que modulo de feature nao precise importar nada: basta
 * injetar `PrismaService` no construtor. E a convencao do repositorio de
 * referencia, e evita a lista de imports repetida em todo modulo.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

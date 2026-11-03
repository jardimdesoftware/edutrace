import { Test, TestingModule } from '@nestjs/testing';
import { AeePlansModule } from 'src/aee-plans/aee-plans.module';
import { AppController } from 'src/app.controller';
import { AppModule } from 'src/app.module';
import { AppService } from 'src/app.service';
import { CaseStudiesModule } from 'src/case-studies/case-studies.module';
import { PrismaService } from 'src/database/prisma.service';
import { PeiEntriesModule } from 'src/pei-entries/pei-entries.module';
import { PATH_METADATA } from '@nestjs/common/constants';
import { APP_GUARD, ModulesContainer } from '@nestjs/core';
import { getOptionsToken } from '@nestjs/throttler';
import { AuthGuard } from 'src/auth/auth.guard';
import { UserThrottlerGuard } from 'src/common/user-throttler.guard';

describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have App Controller defined', () => {
    const controller = module.get<AppController>(AppController);
    expect(controller).toBeDefined();
  });

  it('should have App Service defined', () => {
    const service = module.get<AppService>(AppService);
    expect(service).toBeDefined();
  });

  // Um módulo que falta nos imports do AppModule some da API em silêncio: os
  // testes de cada módulo o montam sozinho e passam, mas as rotas respondem 404.
  it.each([
    ['CaseStudiesModule', CaseStudiesModule],
    ['AeePlansModule', AeePlansModule],
    ['PeiEntriesModule', PeiEntriesModule],
  ])('should import the %s', (_name, importedModule) => {
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];

    expect(imports).toContain(importedModule);
  });

  // O PEI antigo (um formulário por estudante) saiu junto com a tabela
  // PlansEducation, que virou PlansEducation_legacy e ficou fora da API. A prova
  // é pelas rotas que a aplicação monta, e não pelo nome de um módulo: um
  // controller que voltasse a declarar o caminho antigo, com qualquer nome de
  // módulo, derrubaria este teste.
  it('should not expose the routes of the old PEI, and expose the ones of the PEI by subject', () => {
    const controllerPaths = [...module.get(ModulesContainer).values()].flatMap(
      (nestModule) =>
        [...nestModule.controllers.values()].map(
          (controller) =>
            Reflect.getMetadata(PATH_METADATA, controller.metatype!) as string,
        ),
    );

    expect(controllerPaths).not.toContain('plans-education');
    expect(controllerPaths).toContain('pei-entries');
  });

  // O Nest executa os guards globais na ordem em que são registrados: o
  // AuthGuard precisa preencher request.user antes da contagem por usuário.
  it('should register the AuthGuard before the UserThrottlerGuard', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as Array<
      { provide?: unknown; useClass?: unknown } | (new () => unknown)
    >;
    const guards = providers
      .filter(
        (provider): provider is { provide: unknown; useClass: unknown } =>
          typeof provider === 'object' && provider.provide === APP_GUARD,
      )
      .map((provider) => provider.useClass);

    expect(guards).toEqual([AuthGuard, UserThrottlerGuard]);
  });

  it('should allow 300 requests per minute on each route by default', () => {
    expect(module.get(getOptionsToken())).toEqual([
      { name: 'default', ttl: 60_000, limit: 300 },
    ]);
  });
});

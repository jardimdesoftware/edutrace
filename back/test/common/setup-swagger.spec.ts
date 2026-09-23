import { SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { setupSwagger } from 'src/common/setup-swagger';

describe('setupSwagger', () => {
  const app = {} as INestApplication;

  beforeEach(() => {
    jest.spyOn(SwaggerModule, 'createDocument').mockReturnValue({} as never);
    jest.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not register the documentation in production', () => {
    setupSwagger(app, true);

    expect(SwaggerModule.setup).not.toHaveBeenCalled();
  });

  it('should register the documentation outside production', () => {
    setupSwagger(app, false);

    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      'swagger',
      app,
      expect.any(Function),
    );
  });

  it('should build the document only when the route is requested', () => {
    setupSwagger(app, false);

    const [, , documentFactory] = (SwaggerModule.setup as jest.Mock).mock
      .calls[0] as [string, INestApplication, () => unknown];

    expect(SwaggerModule.createDocument).not.toHaveBeenCalled();

    documentFactory();

    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(
      app,
      expect.objectContaining({ info: expect.anything() }),
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UsersController } from 'src/users/users.controller';
import { UsersService } from 'src/users/users.service';
import { LEVELS } from 'src/constants';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser = {
    id: 1,
    full_name: 'Test User',
    cpf: '12345678900',
    email: 'test@test.com',
    password: 'hashedPassword',
    affliation: 'Test',
    pedagogical_manager_id: null,
    external_manager_name: null,
    external_manager_phone: null,
    external_manager_cpf: null,
    password_reset_token: null,
    password_reset_expires: null,
    password_reset_attempts: 0,
    must_change_password: false,
    failed_login_attempts: 0,
    locked_until: null,
    login_lock_count: 0,
    roles: [LEVELS.ALUNO_ESTUDANTE],
    id_current_phase: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  // Recorte que create e findAll devolvem: sem a senha, sem os
  // campos de recuperação e sem os contadores de bloqueio.
  const {
    password: _senha,
    password_reset_token: _token,
    password_reset_expires: _expira,
    password_reset_attempts: _tentativas,
    must_change_password: _troca,
    failed_login_attempts: _falhas,
    locked_until: _bloqueio,
    login_lock_count: _bloqueios,
    ...camposPublicos
  } = mockUser;

  const mockPublicUser = {
    ...camposPublicos,
    current_phase: { id: 1, name: 'Triagem' },
  };

  const maskedUser = { ...mockPublicUser, cpf: '***.456.789-**' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            confirmDeletionCredentials: jest.fn(),
            markForDeletion: jest.fn(),
            restore: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      full_name: 'New User',
      email: 'new@test.com',
      password: '123',
    };
    const requestOf = (...roles: number[]) => ({ user: { roles } }) as any;

    it.each([
      LEVELS.ADMIN,
      LEVELS.ALUNO_ESTUDANTE,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
    ])(
      'should create a user of level %i when requester is admin',
      async (id_level) => {
        const dto = { ...createDto, roles: [id_level] };
        jest
          .spyOn(service, 'create')
          .mockResolvedValue(mockPublicUser as never);

        const result = await controller.create(
          dto as any,
          requestOf(LEVELS.ADMIN),
        );

        expect(service.create).toHaveBeenCalledWith(dto);
        expect(result).toEqual(maskedUser);
      },
    );

    it('should create a student with the level written explicitly when requester is admin and roles is absent', async () => {
      jest.spyOn(service, 'create').mockResolvedValue(mockPublicUser as never);

      const result = await controller.create(
        createDto as any,
        requestOf(LEVELS.ADMIN),
      );

      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        roles: [LEVELS.ALUNO_ESTUDANTE],
      });
      expect(result).toEqual(maskedUser);
    });

    it('should create a student when requester is NAPNE and roles is the student role', async () => {
      const dto = { ...createDto, roles: [LEVELS.ALUNO_ESTUDANTE] };
      jest.spyOn(service, 'create').mockResolvedValue(mockPublicUser as never);

      const result = await controller.create(
        dto as any,
        requestOf(LEVELS.PROFISSIONAL_NAPNE),
      );

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(maskedUser);
    });

    it.each([
      ['absent', createDto],
      ['null', { ...createDto, roles: null }],
    ])(
      'should create a student with the level written explicitly when requester is NAPNE and roles is %s',
      async (_case, dto) => {
        jest
          .spyOn(service, 'create')
          .mockResolvedValue(mockPublicUser as never);

        const result = await controller.create(
          dto as any,
          requestOf(LEVELS.PROFISSIONAL_NAPNE),
        );

        expect(service.create).toHaveBeenCalledWith({
          ...createDto,
          roles: [LEVELS.ALUNO_ESTUDANTE],
        });
        expect(result).toEqual(maskedUser);
      },
    );

    it.each([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
    ])(
      'should throw ForbiddenException and not create when NAPNE sends the role %i',
      async (id_level) => {
        await expect(
          controller.create(
            { ...createDto, roles: [id_level] } as any,
            requestOf(LEVELS.PROFISSIONAL_NAPNE),
          ),
        ).rejects.toThrow(ForbiddenException);
        expect(service.create).not.toHaveBeenCalled();
      },
    );

    it.each([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_SAUDE])(
      'should throw ForbiddenException and not create when requester is level %i',
      async (requesterLevel) => {
        await expect(
          controller.create(createDto as any, requestOf(requesterLevel)),
        ).rejects.toThrow(ForbiddenException);
        expect(service.create).not.toHaveBeenCalled();
      },
    );

    it('should create a user with combined professional roles when requester is admin', async () => {
      const dto = {
        ...createDto,
        roles: [LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFESSOR_AEE],
      };
      jest.spyOn(service, 'create').mockResolvedValue(mockPublicUser as never);

      await controller.create(dto as any, requestOf(LEVELS.ADMIN));

      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should let an Education + NAPNE account create a student', async () => {
      jest.spyOn(service, 'create').mockResolvedValue(mockPublicUser as never);

      await controller.create(
        { ...createDto, roles: [LEVELS.ALUNO_ESTUDANTE] } as any,
        requestOf(LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_NAPNE),
      );

      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it.each([
      [LEVELS.PROFISSIONAL_EDUCACAO],
      [LEVELS.PROFISSIONAL_NAPNE, LEVELS.PROFESSOR_AEE],
      [LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_NAPNE],
    ])(
      'should not let an account with the NAPNE role and no Administrator create roles %j',
      async (...roles) => {
        await expect(
          controller.create(
            { ...createDto, roles: [LEVELS.ADMIN] } as any,
            requestOf(LEVELS.PROFISSIONAL_NAPNE, ...roles),
          ),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          controller.create(
            { ...createDto, roles } as any,
            requestOf(LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_NAPNE),
          ),
        ).rejects.toThrow(ForbiddenException);
        expect(service.create).not.toHaveBeenCalled();
      },
    );

    it.each([
      [LEVELS.PROFESSOR_AEE],
      [LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFESSOR_AEE],
    ])(
      'should throw ForbiddenException when the requester has only the roles %j',
      async (...roles) => {
        await expect(
          controller.create(createDto as any, requestOf(...roles)),
        ).rejects.toThrow(ForbiddenException);
        expect(service.create).not.toHaveBeenCalled();
      },
    );

    it('should throw ForbiddenException and not create when the request has no session user', async () => {
      await expect(
        controller.create(createDto as any, {} as any),
      ).rejects.toThrow(ForbiddenException);
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of users with masked cpf', async () => {
      jest
        .spyOn(service, 'findAll')
        .mockResolvedValue([mockPublicUser as never]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([maskedUser]);
    });
  });

  describe('access levels', () => {
    it('should open create to the administrator and the NAPNE professional only', () => {
      const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller.create);

      expect(levels).toEqual([LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE]);
    });

    it.each(['findAll', 'update', 'remove'] as const)(
      'should restrict %s to the administrator',
      (route) => {
        const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]);

        expect(levels).toEqual([LEVELS.ADMIN]);
      },
    );

    it.each(['findAll', 'update', 'remove'] as const)(
      'should deny %s to the NAPNE professional',
      (route) => {
        const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]);

        expect(levels).not.toContain(LEVELS.PROFISSIONAL_NAPNE);
      },
    );
  });

  // UsersService seleciona só os campos públicos (PUBLIC_USER_SELECT), sem o
  // telefone e o CPF do responsável externo, porque o Administrador não lê esse
  // contato. O mascaramento do CPF continua valendo caso o campo apareça.
  describe('contato do responsável externo', () => {
    const withContact = {
      ...mockPublicUser,
      external_manager_name: 'Maria da Silva',
      external_manager_phone: '81999998888',
      external_manager_cpf: '98765432100',
    };
    const masked = {
      ...withContact,
      cpf: '***.456.789-**',
      external_manager_cpf: '***.654.321-**',
    };

    it('should mask both cpfs in every route and keep the phone', async () => {
      const requester = { user: { roles: [LEVELS.ADMIN] } } as any;
      const deleter = { user: { sub: 9, jti: 'sessao-9' } } as any;
      jest.spyOn(service, 'create').mockResolvedValue(withContact as never);
      jest.spyOn(service, 'findAll').mockResolvedValue([withContact] as never);
      jest.spyOn(service, 'update').mockResolvedValue(withContact as never);
      jest
        .spyOn(service, 'markForDeletion')
        .mockResolvedValue(withContact as never);

      const results = [
        await controller.create({ roles: [2] } as any, requester),
        await controller.findAll(),
        await controller.update('test@test.com', {} as any),
        (await controller.remove(1, {}, deleter)).user,
      ];

      expect(results).toEqual([masked, [masked], masked, masked]);
      expect(JSON.stringify(results)).not.toMatch(/98765432100|12345678900/);
    });
  });

  describe('update', () => {
    it('should update a user and return it with masked cpf', async () => {
      const updateDto = { full_name: 'Updated' };
      const updatedUser = { ...mockPublicUser, full_name: 'Updated' };
      jest.spyOn(service, 'update').mockResolvedValue(updatedUser as never);

      const result = await controller.update('test@test.com', updateDto as any);

      expect(service.update).toHaveBeenCalledWith('test@test.com', updateDto);
      expect(result).toEqual({ ...maskedUser, full_name: 'Updated' });
    });
  });

  describe('remove', () => {
    const req = { user: { sub: 9, jti: 'sessao-9' } } as any;

    it('should confirm the password, mark the user and return it with masked cpf', async () => {
      const until = new Date('2026-11-03T12:10:00.000Z');
      jest.spyOn(service, 'confirmDeletionCredentials').mockResolvedValue(until);
      jest
        .spyOn(service, 'markForDeletion')
        .mockResolvedValue(mockPublicUser as never);
      const dto = { currentPassword: 'senha', remember: true };

      const result = await controller.remove(1, dto, req);

      expect(service.confirmDeletionCredentials).toHaveBeenCalledWith(
        req.user,
        dto,
      );
      expect(service.markForDeletion).toHaveBeenCalledWith(1, 9);
      expect(result).toEqual({ user: maskedUser, reauth_until: until });
    });

    it('should not touch the user when the confirmation fails', async () => {
      jest
        .spyOn(service, 'confirmDeletionCredentials')
        .mockRejectedValue(new UnauthorizedException('Senha incorreta.'));

      await expect(controller.remove(1, {}, req)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(service.markForDeletion).not.toHaveBeenCalled();
    });

    it('should answer null when the confirmation came from the open window and not from the password', async () => {
      jest.spyOn(service, 'confirmDeletionCredentials').mockResolvedValue(null);
      jest
        .spyOn(service, 'markForDeletion')
        .mockResolvedValue(mockPublicUser as never);

      const result = await controller.remove(1, {}, req);

      expect(result.reauth_until).toBeNull();
    });

    it('should open DELETE only to the administrator', () => {
      expect(Reflect.getMetadata(ALLOW_LEVELS_KEY, controller.remove)).toEqual([
        LEVELS.ADMIN,
      ]);
    });
  });

  describe('restore', () => {
    it('should restore the user and return it with masked cpf', async () => {
      jest.spyOn(service, 'restore').mockResolvedValue(mockPublicUser as never);

      const result = await controller.restore(1);

      expect(service.restore).toHaveBeenCalledWith(1);
      expect(result).toEqual(maskedUser);
    });

    it('should open POST restore only to the administrator', () => {
      expect(Reflect.getMetadata(ALLOW_LEVELS_KEY, controller.restore)).toEqual([
        LEVELS.ADMIN,
      ]);
    });
  });
});

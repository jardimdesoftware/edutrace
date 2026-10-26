import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersController } from 'src/users/users.controller';
import { UsersService } from 'src/users/users.service';
import { LEVELS, MANAGER_CONTACT_READERS } from 'src/constants';
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

  // Recorte que create, findAll e findOnePublic devolvem: sem a senha, sem os
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
            findOnePublic: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
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

  describe('findOne', () => {
    it('should return a user by email with masked cpf', async () => {
      jest
        .spyOn(service, 'findOnePublic')
        .mockResolvedValue(mockPublicUser as never);

      const result = await controller.findOne('test@test.com');

      expect(service.findOnePublic).toHaveBeenCalledWith('test@test.com');
      expect(result).toEqual(maskedUser);
    });

    it('should return null when the user does not exist', async () => {
      jest.spyOn(service, 'findOnePublic').mockResolvedValue(null);

      const result = await controller.findOne('missing@test.com');

      expect(result).toBeNull();
    });
  });

  describe('access levels', () => {
    it('should open create to the administrator and the NAPNE professional only', () => {
      const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller.create);

      expect(levels).toEqual([LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE]);
    });

    it.each(['findAll', 'findOne', 'update', 'remove'] as const)(
      'should restrict %s to the administrator',
      (route) => {
        const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]);

        expect(levels).toEqual([LEVELS.ADMIN]);
      },
    );

    it.each(['findAll', 'findOne', 'update', 'remove'] as const)(
      'should deny %s to the NAPNE professional',
      (route) => {
        const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]);

        expect(levels).not.toContain(LEVELS.PROFISSIONAL_NAPNE);
      },
    );
  });

  // UsersService sempre seleciona o telefone e o CPF do responsável externo
  // (USER_WITH_MANAGER_CONTACT_SELECT), então toda rota que o chama tem de ser
  // de nível que lê esse contato. Rota nova para outro nível precisa escolher o
  // select por userSelectFor, e este teste avisa antes de o contato vazar.
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
      jest.spyOn(service, 'create').mockResolvedValue(withContact as never);
      jest.spyOn(service, 'findAll').mockResolvedValue([withContact] as never);
      jest
        .spyOn(service, 'findOnePublic')
        .mockResolvedValue(withContact as never);
      jest.spyOn(service, 'update').mockResolvedValue(withContact as never);
      jest.spyOn(service, 'remove').mockResolvedValue(withContact as never);

      const results = [
        await controller.create({ roles: [2] } as any, requester),
        await controller.findAll(),
        await controller.findOne('test@test.com'),
        await controller.update('test@test.com', {} as any),
        await controller.remove('1'),
      ];

      expect(results).toEqual([masked, [masked], masked, masked, masked]);
      expect(JSON.stringify(results)).not.toMatch(/98765432100|12345678900/);
    });

    it.each(['create', 'findAll', 'findOne', 'update', 'remove'] as const)(
      'should open %s only to levels that read the contact of the external manager',
      (route) => {
        const levels: number[] = Reflect.getMetadata(
          ALLOW_LEVELS_KEY,
          controller[route],
        );

        for (const level of levels) {
          expect(MANAGER_CONTACT_READERS).toContain(level);
        }
      },
    );
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
    it('should remove a user by id and return it with masked cpf', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(mockPublicUser as never);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(maskedUser);
    });
  });
});

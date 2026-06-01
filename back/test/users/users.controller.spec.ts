import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersController } from 'src/users/users.controller';
import { UsersService } from 'src/users/users.service';
import { LEVELS } from 'src/constants';

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
    pedagogical_manager: 'Manager',
    id_level: LEVELS.ALUNO_ESTUDANTE,
    id_current_phase: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

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
    it('should create a user when requester is admin', async () => {
      const createDto = { full_name: 'New User', email: 'new@test.com', password: '123' };
      const adminRequest = { user: { id_level: LEVELS.ADMIN } } as any;
      jest.spyOn(service, 'create').mockResolvedValue(mockUser);

      const result = await controller.create(createDto as any, adminRequest);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockUser);
    });

    it('should throw ForbiddenException when requester is not admin', () => {
      const createDto = { full_name: 'New User', email: 'new@test.com', password: '123' };
      const nonAdminRequest = { user: { id_level: LEVELS.PROFISSIONAL_EDUCACAO } } as any;

      expect(() => controller.create(createDto as any, nonAdminRequest)).toThrow(
        ForbiddenException,
      );
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([mockUser as any]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findOne', () => {
    it('should return a user by email', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockUser);

      const result = await controller.findOne('test@test.com');

      expect(service.findOne).toHaveBeenCalledWith('test@test.com');
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateDto = { full_name: 'Updated' };
      const updatedUser = { ...mockUser, full_name: 'Updated' };
      jest.spyOn(service, 'update').mockResolvedValue(updatedUser);

      const result = await controller.update('test@test.com', updateDto as any);

      expect(service.update).toHaveBeenCalledWith('test@test.com', updateDto);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('remove', () => {
    it('should remove a user by id', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(mockUser);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });
  });
});

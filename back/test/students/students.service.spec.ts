import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS } from 'src/constants';
import { PUBLIC_USER_SELECT } from 'src/users/users.select';
import { StudentsService } from 'src/students/students.service';

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should not select the password nor the recovery fields', () => {
      const camposSensiveis = [
        'password',
        'password_reset_token',
        'password_reset_expires',
        'password_reset_attempts',
        'failed_login_attempts',
        'locked_until',
        'login_lock_count',
      ];

      camposSensiveis.forEach((campo) =>
        expect(PUBLIC_USER_SELECT).not.toHaveProperty(campo),
      );
    });

    it('should return an array of students', async () => {
      const studentsList = [
        {
          id: 1,
          full_name: 'Luizin',
          cpf: '12345678910',
          email: 'luizin@hotmail.com',
          affliation: 'Filiação',
          pedagogical_manager: 'Luizin',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          id_level: 2,
          id_current_phase: 1,
          level: { id: 2, name: 'Aluno/Estudante' },
          current_phase: { id: 1, name: 'Triagem' },
        },
        {
          id: 2,
          full_name: 'Luizin',
          cpf: '12345678910',
          email: 'luizin@hotmail.com',
          affliation: 'Filiação',
          pedagogical_manager: 'Luizin',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          id_level: 2,
          id_current_phase: 1,
          level: { id: 2, name: 'Aluno/Estudante' },
          current_phase: { id: 1, name: 'Triagem' },
        },
      ];
      jest
        .spyOn(prisma.user, 'findMany')
        .mockResolvedValue(studentsList as never);

      const result = await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id_level: LEVELS.ALUNO_ESTUDANTE,
        },
        select: PUBLIC_USER_SELECT,
      });
      expect(result).toEqual(studentsList);
    });
  });

  describe('findOne', () => {
    it('should search the email only among students, without sensitive fields', async () => {
      const student = {
        id: 1,
        full_name: 'Luizin',
        cpf: '12345678910',
        email: 'luizin@hotmail.com',
        id_level: LEVELS.ALUNO_ESTUDANTE,
      };
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(student as never);

      const result = await service.findOne('luizin@hotmail.com');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'luizin@hotmail.com',
          id_level: LEVELS.ALUNO_ESTUDANTE,
        },
        select: PUBLIC_USER_SELECT,
      });
      expect(result).toEqual(student);
    });

    it('should return null for the email of an administrator or a professional', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

      await expect(service.findOne('admin@edutrace.com')).resolves.toBeNull();
    });
  });

  describe('findOneOrFail', () => {
    it.each([{ email: 'estudante@example.com' }, { id: 2 }])(
      'should look the student up by %p filtering by the student level',
      async (where) => {
        jest
          .spyOn(prisma.user, 'findFirst')
          .mockResolvedValue({
            id: 2,
            email: 'estudante@example.com',
          } as never);

        await expect(service.findOneOrFail(where)).resolves.toEqual({
          id: 2,
          email: 'estudante@example.com',
        });
        expect(prisma.user.findFirst).toHaveBeenCalledWith({
          where: { ...where, id_level: LEVELS.ALUNO_ESTUDANTE },
          select: { id: true, email: true },
        });
      },
    );

    // O filtro de nível fica na consulta: administrador, profissional e
    // e-mail sem conta caem no mesmo 404.
    it('should throw NotFoundException when no student matches', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

      await expect(
        service.findOneOrFail({ email: 'profissional@example.com' }),
      ).rejects.toThrow(new NotFoundException('Estudante não encontrado'));
    });
  });

  describe('findAllEmails', () => {
    it('should return the e-mails of the students', async () => {
      jest
        .spyOn(prisma.user, 'findMany')
        .mockResolvedValue([
          { email: 'a@example.com' },
          { email: 'b@example.com' },
        ] as never);

      await expect(service.findAllEmails()).resolves.toEqual([
        'a@example.com',
        'b@example.com',
      ]);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id_level: LEVELS.ALUNO_ESTUDANTE },
        select: { email: true },
      });
    });
  });
});

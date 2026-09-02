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
          comments: [],
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
          comments: [],
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
});

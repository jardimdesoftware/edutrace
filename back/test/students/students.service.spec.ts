import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS } from 'src/constants';
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
    it('should return an array of students', async () => {
      const studentsList = [
        {
          id: 1,
          full_name: 'Luizin',
          cpf: '12345678910',
          email: 'luizin@hotmail.com',
          password: 'senhaSegura123',
          affliation: 'Filiação',
          pedagogical_manager: 'Luizin',
          password_reset_token: null,
          password_reset_expires: null,
          password_reset_attempts: 0,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          id_level: 2,
          id_current_phase: 1,
        },
        {
          id: 2,
          full_name: 'Luizin',
          cpf: '12345678910',
          email: 'luizin@hotmail.com',
          password: 'senhaSegura123',
          affliation: 'Filiação',
          pedagogical_manager: 'Luizin',
          password_reset_token: null,
          password_reset_expires: null,
          password_reset_attempts: 0,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          id_level: 2,
          id_current_phase: 1,
        },
      ];
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(studentsList);

      const result = await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id_level: LEVELS.ALUNO_ESTUDANTE,
        },
      });
      expect(result).toEqual(studentsList);
    });
  });
});

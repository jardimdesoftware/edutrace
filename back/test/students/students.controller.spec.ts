import { Test, TestingModule } from '@nestjs/testing';
import { StudentsController } from 'src/students/students.controller';
import { StudentsService } from 'src/students/students.service';
import { LEVELS } from 'src/constants';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';

describe('PlansEducationController', () => {
  let controller: StudentsController;
  let service: StudentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        {
          provide: StudentsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StudentsController>(StudentsController);
    service = module.get<StudentsService>(StudentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of students with masked cpf', async () => {
      const result = [
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
      jest.spyOn(service, 'findAll').mockResolvedValue(result as never);

      const masked = result.map((student) => ({
        ...student,
        cpf: '***.456.789-**',
      }));

      expect(await controller.findAll()).toEqual(masked);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return the student with masked cpf', async () => {
      const student = {
        id: 1,
        full_name: 'Luizin',
        cpf: '12345678910',
        email: 'luizin@hotmail.com',
        id_level: 2,
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(student as never);

      expect(await controller.findOne('luizin@hotmail.com')).toEqual({
        ...student,
        cpf: '***.456.789-**',
      });
      expect(service.findOne).toHaveBeenCalledWith('luizin@hotmail.com');
    });

    it('should return null when the email is not a student', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      expect(await controller.findOne('admin@edutrace.com')).toBeNull();
    });
  });

  describe('access levels', () => {
    it.each(['findAll', 'findOne'] as const)(
      'should allow %s to every level except students',
      (route) => {
        const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]);

        expect(levels).toEqual([
          LEVELS.ADMIN,
          LEVELS.PROFISSIONAL_EDUCACAO,
          LEVELS.PROFISSIONAL_SAUDE,
        ]);
      },
    );
  });
});

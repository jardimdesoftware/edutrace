import { Test, TestingModule } from '@nestjs/testing';
import { StudentsController } from 'src/students/students.controller';
import { StudentsService } from 'src/students/students.service';

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
      jest.spyOn(service, 'findAll').mockResolvedValue(result as never);

      const masked = result.map((student) => ({
        ...student,
        cpf: '***.456.789-**',
      }));

      expect(await controller.findAll()).toEqual(masked);
      expect(service.findAll).toHaveBeenCalled();
    });
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS } from 'src/constants';
import {
  PUBLIC_USER_SELECT,
  USER_WITH_MANAGER_CONTACT_SELECT,
} from 'src/users/users.select';
import { StudentsService } from 'src/students/students.service';
import { SetPedagogicalManagerDto } from 'src/students/dto/set-pedagogical-manager.dto';

const EMAIL = 'estudante@example.com';
const STUDENT_ID = 2;

const NO_EXTERNAL = {
  external_manager_name: null,
  external_manager_phone: null,
  external_manager_cpf: null,
};

const INVALID_SERVER_MESSAGE =
  'O responsável pedagógico precisa ser um Profissional da Educação, um Profissional NAPNE ou um Professor do AEE.';

const SELF_MANAGER_MESSAGE =
  'O estudante não pode ser o próprio responsável pedagógico.';

describe('StudentsService, responsável pedagógico', () => {
  let service: StudentsService;
  let prisma: {
    user: { findFirst: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: { $queryRaw: jest.Mock; user: { update: jest.Mock } };
  let serverRows: unknown[];
  let studentRows: unknown[];

  const saved = { id: STUDENT_ID, email: EMAIL };

  // A leitura que trava a linha do servidor (FOR SHARE) devolve o nível dele,
  // ou nada quando a conta não existe.
  const serverLevel = (id_level: number | null) => {
    serverRows = id_level === null ? [] : [{ roles: [id_level] }];
  };

  // A leitura que trava a linha do estudante (FOR UPDATE) só encontra quem
  // ainda é do nível Estudante/Família.
  const noStudent = () => {
    studentRows = [];
  };

  const sqlOf = (call: unknown[]) =>
    (call[0] as TemplateStringsArray).join('?');

  const locks = () =>
    tx.$queryRaw.mock.calls.map((call: unknown[]) => ({
      sql: sqlOf(call),
      values: call.slice(1),
    }));

  const set = (
    dto: Partial<SetPedagogicalManagerDto>,
    requesterLevel: number = LEVELS.ADMIN,
  ) =>
    service.setPedagogicalManager(EMAIL, dto as SetPedagogicalManagerDto, [
      requesterLevel,
    ]);

  beforeEach(async () => {
    serverRows = [];
    studentRows = [{ id: STUDENT_ID }];
    tx = {
      $queryRaw: jest.fn((strings: TemplateStringsArray) =>
        Promise.resolve(
          strings.join('?').includes('FOR SHARE') ? serverRows : studentRows,
        ),
      ),
      user: { update: jest.fn().mockResolvedValue(saved) },
    };
    prisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (client: unknown) => unknown) =>
        callback(tx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(StudentsService);
  });

  describe('findPedagogicalManagerOptions', () => {
    it('should list only the id, the name and the level of the Education, NAPNE and AEE professionals, by name', async () => {
      const options = [
        { id: 4, full_name: 'Ana', roles: [LEVELS.PROFISSIONAL_NAPNE] },
      ];
      prisma.user.findMany.mockResolvedValue(options);

      await expect(service.findPedagogicalManagerOptions()).resolves.toBe(
        options,
      );
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          roles: {
            hasSome: [
              LEVELS.PROFISSIONAL_EDUCACAO,
              LEVELS.PROFISSIONAL_NAPNE,
              LEVELS.PROFESSOR_AEE,
            ],
          },
        },
        select: { id: true, full_name: true, roles: true },
        orderBy: { full_name: 'asc' },
      });
    });
  });

  describe('setPedagogicalManager, kind SERVER', () => {
    it.each([
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_NAPNE,
      LEVELS.PROFESSOR_AEE,
    ])(
      'should link a server of the level %s and clear the external manager',
      async (id_level) => {
        serverLevel(id_level);

        const result = await set({ kind: 'SERVER', user_id: 9 });

        expect(tx.user.update).toHaveBeenCalledWith({
          where: { id: STUDENT_ID },
          data: { pedagogical_manager_id: 9, ...NO_EXTERNAL },
          select: USER_WITH_MANAGER_CONTACT_SELECT,
        });
        expect(result).toBe(saved);
      },
    );

    it.each([
      ['Administrador', LEVELS.ADMIN, USER_WITH_MANAGER_CONTACT_SELECT],
      [
        'Profissional NAPNE',
        LEVELS.PROFISSIONAL_NAPNE,
        USER_WITH_MANAGER_CONTACT_SELECT,
      ],
      [
        'um nível sem acesso ao contato',
        LEVELS.PROFISSIONAL_SAUDE,
        PUBLIC_USER_SELECT,
      ],
    ])(
      'should answer for %s with the select of its level',
      async (_, requesterLevel, select) => {
        serverLevel(LEVELS.PROFISSIONAL_NAPNE);

        await set({ kind: 'SERVER', user_id: 9 }, requesterLevel);

        expect(tx.user.update.mock.calls[0][0].select).toBe(select);
      },
    );

    it.each([
      ['Administrador', LEVELS.ADMIN],
      ['Estudante', LEVELS.ALUNO_ESTUDANTE],
      ['Profissional de Saúde', LEVELS.PROFISSIONAL_SAUDE],
    ])('should answer 400 for a %s and write nothing', async (_, id_level) => {
      serverLevel(id_level);

      await expect(set({ kind: 'SERVER', user_id: 9 })).rejects.toThrow(
        new BadRequestException(INVALID_SERVER_MESSAGE),
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should answer 400 when the server does not exist and write nothing', async () => {
      serverLevel(null);

      await expect(set({ kind: 'SERVER', user_id: 999 })).rejects.toThrow(
        new BadRequestException(INVALID_SERVER_MESSAGE),
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    // Sem a trava, o nível do servidor poderia mudar entre a conferência e a
    // gravação, e o estudante ficaria ligado a quem já não é nível 3 ou 5. A
    // troca de nível trava a mesma linha com FOR UPDATE, que espera esta
    // transação terminar.
    it('should lock the server row with FOR SHARE inside the transaction before writing', async () => {
      serverLevel(LEVELS.PROFISSIONAL_EDUCACAO);

      await set({ kind: 'SERVER', user_id: 9 });

      const [serverLock] = locks();
      expect(serverLock.sql).toContain('FOR SHARE');
      expect(serverLock.values).toEqual([9]);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.user.update.mock.invocationCallOrder[0],
      );
    });

    // A troca de nível do servidor (UsersService.update) trava a linha dele e
    // depois as dos estudantes ligados a ele. Esta transação segue a mesma
    // ordem, servidor e depois estudante. Na ordem inversa, as duas esperariam
    // uma pela outra (deadlock).
    it('should lock the server row first and the student row second', async () => {
      serverLevel(LEVELS.PROFISSIONAL_EDUCACAO);

      await set({ kind: 'SERVER', user_id: 9 });

      const [first, second] = locks();
      expect(locks()).toHaveLength(2);
      expect(first.sql).toContain('FOR SHARE');
      expect(second.sql).toContain('FOR UPDATE');
      expect(second.values).toEqual([EMAIL, LEVELS.ALUNO_ESTUDANTE]);
    });

    it('should answer 400 for a body without user_id', async () => {
      await expect(set({ kind: 'SERVER' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should ignore the external fields and never write both kinds', async () => {
      serverLevel(LEVELS.PROFISSIONAL_NAPNE);

      await set({
        kind: 'SERVER',
        user_id: 9,
        name: 'Maria',
        phone: '81999998888',
        cpf: '01234567890',
      });

      expect(tx.user.update.mock.calls[0][0].data).toEqual({
        pedagogical_manager_id: 9,
        ...NO_EXTERNAL,
      });
    });

    // A conta que é do nível 3 ou 5 não é estudante, então a trava do estudante
    // não a encontra. A recusa explícita cobre o caso em que as duas leituras
    // devolvessem a mesma conta.
    it('should answer 400 and write nothing when the server is the student itself', async () => {
      serverLevel(LEVELS.PROFISSIONAL_EDUCACAO);

      await expect(
        set({ kind: 'SERVER', user_id: STUDENT_ID }),
      ).rejects.toThrow(new BadRequestException(SELF_MANAGER_MESSAGE));
      expect(tx.user.update).not.toHaveBeenCalled();
    });
  });

  describe('setPedagogicalManager, kind EXTERNAL', () => {
    const external = {
      kind: 'EXTERNAL',
      name: 'Maria da Silva',
      phone: '81999998888',
      cpf: '01234567890',
    } as const;

    it('should save the three fields by the id of the locked student and clear the server link', async () => {
      const result = await set(external);

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: STUDENT_ID },
        data: {
          pedagogical_manager_id: null,
          external_manager_name: 'Maria da Silva',
          external_manager_phone: '81999998888',
          external_manager_cpf: '01234567890',
        },
        select: USER_WITH_MANAGER_CONTACT_SELECT,
      });
      expect(result).toBe(saved);
    });

    it('should not look up any server, and lock only the student row', async () => {
      await set(external);

      expect(locks()).toHaveLength(1);
      expect(locks()[0].sql).not.toContain('FOR SHARE');
      expect(locks()[0].sql).toContain('FOR UPDATE');
    });

    it.each(['name', 'phone', 'cpf'] as const)(
      'should answer 400 and write nothing when %s is missing',
      async (field) => {
        const { [field]: _removed, ...incomplete } = external;

        await expect(set(incomplete)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(tx.user.update).not.toHaveBeenCalled();
      },
    );

    it('should ignore a user_id and never write both kinds', async () => {
      await set({ ...external, user_id: 9 });

      expect(tx.user.update.mock.calls[0][0].data.pedagogical_manager_id).toBe(
        null,
      );
    });
  });

  describe('setPedagogicalManager, kind NONE', () => {
    it('should clear the server link and the external manager', async () => {
      await set({ kind: 'NONE' });

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: STUDENT_ID },
        data: { pedagogical_manager_id: null, ...NO_EXTERNAL },
        select: USER_WITH_MANAGER_CONTACT_SELECT,
      });
    });
  });

  // O nível do estudante é conferido dentro da transação, na própria trava da
  // linha. Conferir antes, fora dela, deixava a troca de nível passar entre a
  // conferência e a gravação, e uma conta que não é estudante ficava com o
  // vínculo.
  describe('setPedagogicalManager, estudante', () => {
    it.each([
      ['SERVER', { kind: 'SERVER', user_id: 9 }],
      ['EXTERNAL', { kind: 'EXTERNAL', name: 'a', phone: 'b', cpf: 'c' }],
      ['NONE', { kind: 'NONE' }],
    ] as const)(
      'should answer 404 and write nothing for the kind %s when the e-mail is not a student',
      async (_, dto) => {
        serverLevel(LEVELS.PROFISSIONAL_NAPNE);
        noStudent();

        await expect(set(dto)).rejects.toThrow(
          new NotFoundException('Estudante não encontrado'),
        );
        expect(tx.user.update).not.toHaveBeenCalled();
      },
    );

    it('should lock the student row filtered by e-mail and by the student level, inside the transaction', async () => {
      await set({ kind: 'NONE' });

      const [studentLock] = locks();
      expect(studentLock.sql).toContain('FOR UPDATE');
      expect(studentLock.sql).toContain('ANY("roles")');
      expect(studentLock.values).toEqual([EMAIL, LEVELS.ALUNO_ESTUDANTE]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should not read the student outside the transaction', async () => {
      await set({ kind: 'NONE' });

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('should write by the id of the row it locked, never by the e-mail', async () => {
      studentRows = [{ id: 41 }];

      await set({ kind: 'NONE' });

      expect(tx.user.update.mock.calls[0][0].where).toEqual({ id: 41 });
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.user.update.mock.invocationCallOrder[0],
      );
    });
  });
});

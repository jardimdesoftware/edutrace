import { CommentType } from '@prisma/client';
import {
  AEE_PLAN_READERS,
  ANAMNESIS_READERS,
  CASE_STUDY_READERS,
  COMBINING_MARKS_MAX_RUN,
  COMMENT_AUTHOR_AREAS,
  COMMENT_LIST_LIMIT,
  COMMENT_LIST_STATEMENT_TIMEOUT_MS,
  COMMENT_LIST_TRANSACTION_MAX_WAIT_MS,
  COMMENT_LIST_TRANSACTION_TIMEOUT_MS,
  COMMENT_MAX_LENGTH,
  COMMENT_SEARCH_MAX_LENGTH,
  LEVELS,
  MANAGER_CONTACT_READERS,
  PEI_ENTRIES_MAX_ACTIVE_PER_STUDENT,
  PEI_ENTRY_READERS,
  PROFESSIONAL_ROLES,
  STUDENT_RECORD_READERS,
} from 'src/constants';

describe('LEVELS', () => {
  it('should keep the ids that the database rows and the guards depend on', () => {
    expect(LEVELS).toEqual({
      ADMIN: 1,
      ALUNO_ESTUDANTE: 2,
      PROFISSIONAL_EDUCACAO: 3,
      PROFISSIONAL_SAUDE: 4,
      PROFISSIONAL_NAPNE: 5,
      PROFESSOR_AEE: 6,
    });
  });
});

describe('STUDENT_RECORD_READERS', () => {
  it('should list every level that reads the records of any student', () => {
    expect(STUDENT_RECORD_READERS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
      LEVELS.PROFESSOR_AEE,
    ]);
  });

  it('should not include the student level', () => {
    expect(STUDENT_RECORD_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
  });
});

describe('ANAMNESIS_READERS', () => {
  it('should list only the NAPNE level as the reader of the anamnesis of any student', () => {
    expect(ANAMNESIS_READERS).toEqual([LEVELS.PROFISSIONAL_NAPNE]);
  });

  it('should not include the student, the administrator, the education nor the health level', () => {
    expect(ANAMNESIS_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
    expect(ANAMNESIS_READERS).not.toContain(LEVELS.ADMIN);
    expect(ANAMNESIS_READERS).not.toContain(LEVELS.PROFISSIONAL_EDUCACAO);
    expect(ANAMNESIS_READERS).not.toContain(LEVELS.PROFISSIONAL_SAUDE);
  });
});

describe('CASE_STUDY_READERS', () => {
  it('should list the Administrator, Education, Health, NAPNE and Professor do AEE levels as readers of the case study of any student', () => {
    expect(CASE_STUDY_READERS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
      LEVELS.PROFESSOR_AEE,
    ]);
  });

  it('should not include the student level, which reads only his own', () => {
    expect(CASE_STUDY_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
  });
});

describe('AEE_PLAN_READERS', () => {
  it('should list the Administrator, Education, Health, NAPNE and Professor do AEE levels as readers of the PAEE of any student', () => {
    expect(AEE_PLAN_READERS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
      LEVELS.PROFESSOR_AEE,
    ]);
  });

  it('should not include the student level, which reads only his own', () => {
    expect(AEE_PLAN_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
  });
});

describe('PEI_ENTRY_READERS', () => {
  it('should list the Administrator, Education, Health, NAPNE and Professor do AEE levels as readers of the PEI of any student', () => {
    expect(PEI_ENTRY_READERS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
      LEVELS.PROFESSOR_AEE,
    ]);
  });

  it('should not include the student level, which reads only his own', () => {
    expect(PEI_ENTRY_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
  });
});

describe('PEI_ENTRIES_MAX_ACTIVE_PER_STUDENT', () => {
  it('should cap at 300 the active entries of the PEI of a student', () => {
    expect(PEI_ENTRIES_MAX_ACTIVE_PER_STUDENT).toBe(300);
  });
});

describe('MANAGER_CONTACT_READERS', () => {
  it('should list only the Administrator and the NAPNE as readers of the phone and the cpf of the external manager', () => {
    expect(MANAGER_CONTACT_READERS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_NAPNE,
    ]);
  });

  it('should not include the student, the education nor the health level', () => {
    expect(MANAGER_CONTACT_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
    expect(MANAGER_CONTACT_READERS).not.toContain(LEVELS.PROFISSIONAL_EDUCACAO);
    expect(MANAGER_CONTACT_READERS).not.toContain(LEVELS.PROFISSIONAL_SAUDE);
  });
});

describe('COMMENT_MAX_LENGTH', () => {
  it('should cap the annotation at 1000 characters and the class council report at 10000', () => {
    expect(COMMENT_MAX_LENGTH).toEqual({
      NOTE: 1000,
      CLASS_COUNCIL_REPORT: 10000,
    });
  });

  it('should have a limit for every value of the CommentType enum, and only for them', () => {
    expect(Object.keys(COMMENT_MAX_LENGTH).sort()).toEqual(
      Object.values(CommentType).sort(),
    );
  });
});

describe('limites da lista de anotações', () => {
  it('should page 20 records by default and at most 50', () => {
    expect(COMMENT_LIST_LIMIT).toEqual({ DEFAULT: 20, MAX: 50 });
  });

  it('should cap the search term at 200 characters', () => {
    expect(COMMENT_SEARCH_MAX_LENGTH).toBe(200);
  });

  it('should allow at most 30 combining marks in a row, the limit of the Stream-Safe Text Format', () => {
    expect(COMBINING_MARKS_MAX_RUN).toBe(30);
  });

  it('should cancel each query of the list after 3 seconds', () => {
    expect(COMMENT_LIST_STATEMENT_TIMEOUT_MS).toBe(3000);
  });

  it('should wait 5 seconds for a free connection to open the transaction of the list', () => {
    expect(COMMENT_LIST_TRANSACTION_MAX_WAIT_MS).toBe(5000);
  });

  it('should keep the transaction of the list open longer than its three queries can take, so the 503 of the database comes before the cut of Prisma', () => {
    expect(COMMENT_LIST_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(
      3 * COMMENT_LIST_STATEMENT_TIMEOUT_MS,
    );
  });

  it('should accept as area the levels of those who write, and not the student', () => {
    expect(COMMENT_AUTHOR_AREAS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
      LEVELS.PROFESSOR_AEE,
    ]);
    expect(COMMENT_AUTHOR_AREAS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
  });
});

describe('PROFESSIONAL_ROLES', () => {
  it('should list the four professional roles, which combine freely', () => {
    expect(PROFESSIONAL_ROLES).toEqual([
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
      LEVELS.PROFESSOR_AEE,
    ]);
  });

  it('should not include the Administrator nor the student, who stay alone', () => {
    expect(PROFESSIONAL_ROLES).not.toContain(LEVELS.ADMIN);
    expect(PROFESSIONAL_ROLES).not.toContain(LEVELS.ALUNO_ESTUDANTE);
  });
});

import {
  ANAMNESIS_READERS,
  LEVELS,
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
    ]);
  });

  it('should not include the student level', () => {
    expect(STUDENT_RECORD_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
  });
});

describe('ANAMNESIS_READERS', () => {
  it('should list every level that reads the anamnesis of any student', () => {
    expect(ANAMNESIS_READERS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
    ]);
  });

  it('should not include the student nor the NAPNE level', () => {
    expect(ANAMNESIS_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
    expect(ANAMNESIS_READERS).not.toContain(LEVELS.PROFISSIONAL_NAPNE);
  });
});

import {
  AEE_PLAN_READERS,
  ANAMNESIS_READERS,
  CASE_STUDY_READERS,
  LEVELS,
  MANAGER_CONTACT_READERS,
  PEI_ENTRIES_MAX_ACTIVE_PER_STUDENT,
  PEI_ENTRY_READERS,
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
  it('should list the Administrator, Education, Health and NAPNE levels as readers of the case study of any student', () => {
    expect(CASE_STUDY_READERS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
    ]);
  });

  it('should not include the student level, which reads only his own', () => {
    expect(CASE_STUDY_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
  });
});

describe('AEE_PLAN_READERS', () => {
  it('should list the Administrator, Education, Health and NAPNE levels as readers of the PAEE of any student', () => {
    expect(AEE_PLAN_READERS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
    ]);
  });

  it('should not include the student level, which reads only his own', () => {
    expect(AEE_PLAN_READERS).not.toContain(LEVELS.ALUNO_ESTUDANTE);
  });
});

describe('PEI_ENTRY_READERS', () => {
  it('should list the Administrator, Education, Health and NAPNE levels as readers of the PEI of any student', () => {
    expect(PEI_ENTRY_READERS).toEqual([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
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

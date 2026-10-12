import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PlansEducationData } from '@/interfaces/PlansEducationData';
import { buildPEIPayload } from './peiPayload';

const form = {
  professor_email: 'outro.professor@example.com',
  professor_name: 'Outro Professor',
  student_email: '',
  student_name: '',
  objectives: 'Objetivos do semestre',
  school_content: 'Conteúdo',
} as unknown as PlansEducationData;

describe('buildPEIPayload', () => {
  // A API grava a autoria a partir da sessão e recusa os campos no corpo.
  it('leaves the author fields out of the body', () => {
    const payload = buildPEIPayload(form, 'aluno@example.test', 'Aluno');

    assert.equal('professor_email' in payload, false);
    assert.equal('professor_name' in payload, false);
  });

  it('fills the student e-mail and name and keeps the form fields', () => {
    const payload = buildPEIPayload(form, 'aluno@example.test', 'Aluno');

    assert.deepEqual(payload, {
      student_email: 'aluno@example.test',
      student_name: 'Aluno',
      objectives: 'Objetivos do semestre',
      school_content: 'Conteúdo',
    });
  });
});

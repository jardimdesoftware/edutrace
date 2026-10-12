import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANAMNESIS_EDIT_FIELDS,
  PEI_EDIT_FIELDS,
  SCREENING_EDIT_FIELDS,
  pickFields,
} from './editPayload';

// Registro como chega do GET: com id, datas e o e-mail do titular, que a API
// recusa no PATCH.
const record = {
  id: 7,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-02T00:00:00.000Z',
  deleted_at: null,
  email: 'aluno@example.test',
  student_email: 'aluno@example.test',
  professor_email: 'professor@example.test',
  professor_name: 'Professor',
  full_name: 'Aluno',
  student_name: 'Aluno',
  special_service: true,
  identification: { turma: 'A' },
  objectives: 'Objetivos',
};

const FORBIDDEN = [
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'email',
  'student_email',
  'professor_email',
  'professor_name',
];

describe('pickFields', () => {
  it('copies only the listed fields', () => {
    assert.deepEqual(pickFields(record, ['full_name', 'special_service']), {
      full_name: 'Aluno',
      special_service: true,
    });
  });

  for (const [name, fields] of [
    ['SCREENING_EDIT_FIELDS', SCREENING_EDIT_FIELDS],
    ['ANAMNESIS_EDIT_FIELDS', ANAMNESIS_EDIT_FIELDS],
    ['PEI_EDIT_FIELDS', PEI_EDIT_FIELDS],
  ] as const) {
    it(`${name} leaves out the id, the dates, the holder and the author`, () => {
      const payload = pickFields(record, fields as readonly (keyof typeof record)[]);

      for (const field of FORBIDDEN) {
        assert.equal(field in payload, false, field);
      }
    });
  }

  it('keeps the editable fields of each screen', () => {
    assert.deepEqual(
      Object.keys(pickFields(record, SCREENING_EDIT_FIELDS as never)),
      [...SCREENING_EDIT_FIELDS],
    );
    assert.ok(ANAMNESIS_EDIT_FIELDS.includes('identification'));
    assert.ok(PEI_EDIT_FIELDS.includes('objectives'));
    assert.ok(PEI_EDIT_FIELDS.includes('student_name'));
  });
});

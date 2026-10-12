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

  // As listas repetem os campos dos DTOs de atualização do back
  // (UpdateScreeningDto, UpdateAnamnesisDto e UpdatePlansEducationDto). Campo
  // a mais faz o PATCH responder 400; campo a menos deixa de ser gravado.
  it('lists exactly the fields of the back end update DTOs', () => {
    assert.deepEqual(
      [...SCREENING_EDIT_FIELDS].sort(),
      [
        'full_name',
        'global_disorder',
        'hearing_impairment',
        'other_disabilities',
        'physical_disability',
        'report',
        'special_service',
        'specific_need',
        'visual_impairment',
      ],
    );
    assert.deepEqual(
      [...ANAMNESIS_EDIT_FIELDS].sort(),
      [
        'development',
        'family_conditions',
        'family_data',
        'identification',
        'mother_background',
        'school_information',
        'sexuality',
        'student_assessment',
        'student_development',
        'verbal_language_three_years',
      ],
    );
    assert.deepEqual(
      [...PEI_EDIT_FIELDS].sort(),
      [
        'academic_semester',
        'activities_to_be_developed',
        'curriculum_accessibility',
        'evaluation_criteria',
        'materials_used',
        'objectives',
        'resource_equipment_needs',
        'resource_equipment_used',
        'school_content',
        'service_modality',
        'skills',
        'student_name',
        'support_service',
        'work_methodology',
      ],
    );
  });
});

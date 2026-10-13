import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReportsData } from '@/interfaces/ReportsData';
import { relatorioVazio } from './reportSections';

const screening = { report: 'Laudo' } as NonNullable<ReportsData['screening']>;
const plansEducation = { objectives: 'Objetivos' } as NonNullable<ReportsData['plansEducation']>;

describe('relatorioVazio', () => {
  it('is empty when the student has neither screening nor PEI', () => {
    assert.equal(relatorioVazio({ screening: null, plansEducation: null }), true);
  });

  it('is not empty with only the screening', () => {
    assert.equal(relatorioVazio({ screening, plansEducation: null }), false);
  });

  it('is not empty with only the PEI', () => {
    assert.equal(relatorioVazio({ screening: null, plansEducation }), false);
  });
});

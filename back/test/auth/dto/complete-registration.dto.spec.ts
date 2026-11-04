import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CompleteRegistrationDto } from 'src/auth/dto/complete-registration.dto';
import { COURSES } from 'src/users/courses';

const STUDENT_FIELDS = {
  enrollment_number: '20261TADS0012',
  course: 'Integrado: Informática',
};

function instance(payload: Record<string, unknown>) {
  return plainToInstance(CompleteRegistrationDto, {
    ...STUDENT_FIELDS,
    ...payload,
  });
}

describe('CompleteRegistrationDto', () => {
  it('should accept a valid CPF and a password with eight characters', () => {
    const errors = validateSync(
      instance({ cpf: '01234567890', password: '12345678' }),
    );

    expect(errors).toHaveLength(0);
  });

  it('should keep only the digits of a masked CPF', () => {
    const dto = instance({ cpf: '012.345.678-90', password: 'senhaSegura123' });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.cpf).toBe('01234567890');
  });

  it('should reject a CPF with wrong check digits', () => {
    const errors = validateSync(
      instance({ cpf: '01234567891', password: 'senhaSegura123' }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      isCpf: 'O campo CPF deve ser um CPF válido.',
    });
  });

  it('should reject a request without the CPF', () => {
    const errors = validateSync(instance({ password: 'senhaSegura123' }));

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('cpf');
  });

  it('should reject a password shorter than eight characters', () => {
    const errors = validateSync(
      instance({ cpf: '01234567890', password: '1234567' }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      minLength: 'A senha deve ter no mínimo 8 caracteres',
    });
  });

  describe('matrícula e curso', () => {
    const base = { cpf: '01234567890', password: 'senhaSegura123' };

    it('should store the enrollment number trimmed and in upper case', () => {
      const dto = instance({ ...base, enrollment_number: ' 20261tads.01 ' });

      expect(validateSync(dto)).toHaveLength(0);
      expect(dto.enrollment_number).toBe('20261TADS.01');
    });

    it('should reject a request without the enrollment number', () => {
      const dto = plainToInstance(CompleteRegistrationDto, {
        ...base,
        course: STUDENT_FIELDS.course,
      });

      const errors = validateSync(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('enrollment_number');
    });

    it('should reject an enrollment number with characters outside the pattern', () => {
      const errors = validateSync(
        instance({ ...base, enrollment_number: '2026 1;DROP' }),
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('enrollment_number');
    });

    it('should reject an enrollment number longer than 30 characters', () => {
      const errors = validateSync(
        instance({ ...base, enrollment_number: 'A'.repeat(31) }),
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('enrollment_number');
    });

    it('should reject a request without the course', () => {
      const dto = plainToInstance(CompleteRegistrationDto, {
        ...base,
        enrollment_number: STUDENT_FIELDS.enrollment_number,
      });

      const errors = validateSync(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toEqual({
        isIn: 'O campo course deve ser um dos cursos da lista.',
      });
    });

    it.each(['Informática', 'integrado: informática', 'Curso inventado', ''])(
      'should reject the course "%s", which is not in the list',
      (course) => {
        const errors = validateSync(instance({ ...base, course }));

        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('course');
      },
    );

    it.each(COURSES)('should accept the course "%s"', (course) => {
      expect(validateSync(instance({ ...base, course }))).toHaveLength(0);
    });
  });
});

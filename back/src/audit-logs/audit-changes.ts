import { maskCpf } from 'src/common/mask-cpf';

export const PROTECTED_VALUE = '[protegido]';

export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

// Credenciais e tokens não entram no log nem mascarados (OWASP Logging Cheat
// Sheet, "Data to exclude"; ASVS 5.0, 16.2.5): o registro diz só que mudaram.
const SECRET_FIELDS = new Set([
  'password',
  'password_reset_token',
  'activation_token',
  'google_sub',
  'external_manager_phone',
]);

const CPF_FIELDS = new Set(['cpf', 'external_manager_cpf']);

// Tabelas com dado de saúde, de desenvolvimento ou pedagógico do estudante. O
// administrador, que lê o log, não lê esses formulários, então o log guarda só
// quais campos mudaram e os metadados (identificadores, datas, tipo, versão).
const CONTENT_MODELS = new Set([
  'Screening',
  'Anamnesis',
  'PlansEducationLegacy',
  'CaseStudy',
  'AeePlan',
  'PeiEntry',
  'FormRevision',
  'Comments',
  'CommentEdits',
  'AeeAppointment',
]);

const CONTENT_METADATA_FIELD =
  /^(id|id_\w+|\w+_id|\w+_at|type|form_type|version|semester|record_key)$/;

// Mudam em toda escrita e não dizem nada sobre o que o usuário alterou.
const IGNORED_FIELDS = new Set(['updated_at']);

export function protectValue(
  model: string,
  field: string,
  value: unknown,
): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (SECRET_FIELDS.has(field)) {
    return PROTECTED_VALUE;
  }
  if (CPF_FIELDS.has(field)) {
    return typeof value === 'string' ? maskCpf(value) : PROTECTED_VALUE;
  }
  if (CONTENT_MODELS.has(model) && !CONTENT_METADATA_FIELD.test(field)) {
    return PROTECTED_VALUE;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Só os campos que mudaram entre o registro de antes e o de depois. A criação
// compara {} com o registro novo, e a exclusão o registro antigo com {}.
export function diffRecords(
  model: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditChanges | null {
  const changes: AuditChanges = {};
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const field of fields) {
    if (IGNORED_FIELDS.has(field) || sameValue(before[field], after[field])) {
      continue;
    }
    changes[field] = {
      from: protectValue(model, field, before[field]),
      to: protectValue(model, field, after[field]),
    };
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

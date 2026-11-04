// Cursos que o estudante pode ter. O curso é uma escolha dessa lista, e não
// texto livre, para que a mesma habilitação não seja gravada com grafias
// diferentes. A lista espelha front/src/utils/cursos.ts.
export const COURSES = [
  'Integrado: Agropecuária',
  'Integrado: Agroindústria',
  'Integrado: Informática',
  'Subsequente: Agropecuária',
  'Subsequente: Agroindústria',
  'Subsequente: Enfermagem',
  'Subsequente: Informática',
  'Bacharelado: Engenharia de Software',
  'Licenciatura: Música',
  'Tecnólogo: Análise e Desenvolvimento de Sistemas',
] as const;

export const COURSE_NOT_IN_LIST_MESSAGE =
  'O campo course deve ser um dos cursos da lista.';

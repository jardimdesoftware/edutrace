import { ESTUDANTE, PROFISSIONAL_NAPNE } from "@/consts";
import { temPapel, type Papeis } from "@/utils/papeis";

// Mesma lista do back (back/src/users/courses.ts). O curso é uma escolha dessa
// lista, e não texto livre, para que a mesma habilitação não tenha grafias
// diferentes.
export const CURSOS = [
  "Integrado: Agropecuária",
  "Integrado: Agroindústria",
  "Integrado: Informática",
  "Subsequente: Agropecuária",
  "Subsequente: Agroindústria",
  "Subsequente: Enfermagem",
  "Subsequente: Informática",
  "Bacharelado: Engenharia de Software",
  "Licenciatura: Música",
  "Tecnólogo: Análise e Desenvolvimento de Sistemas",
] as const;

export type Curso = (typeof CURSOS)[number];

export function ehCurso(valor: string | null | undefined): valor is Curso {
  return CURSOS.some((curso) => curso === valor);
}

// A regra definitiva é do back (só o NAPNE). Aqui só decide se o seletor
// aparece; o curso é de estudante.
export function podeAlterarCurso(
  usuario?: { roles: Papeis } | null,
  estudante?: { roles?: Papeis } | null,
): boolean {
  return (
    temPapel(usuario?.roles, PROFISSIONAL_NAPNE) &&
    temPapel(estudante?.roles, ESTUDANTE)
  );
}

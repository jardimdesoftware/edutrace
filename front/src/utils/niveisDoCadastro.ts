import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "@/consts";

export type NivelDoCadastro = { value: string; label: string };

const NIVEIS: readonly NivelDoCadastro[] = [
  { value: String(ADMIN), label: "Administrador" },
  { value: String(ESTUDANTE), label: "Pais/Responsáveis e Estudante" },
  { value: String(PROFISSIONAL_EDUCACAO), label: "Profissional da Educação" },
  { value: String(PROFISSIONAL_SAUDE), label: "Profissional da Saúde" },
  { value: String(PROFISSIONAL_NAPNE), label: "Profissional NAPNE" },
];

// Níveis que quem cadastra pode atribuir, como o POST /users do back: o
// administrador cria qualquer nível e o NAPNE só o de estudante. O back
// recusa o resto; esta lista evita oferecer o que ele negaria.
export function niveisDoCadastro(idLevel?: number): readonly NivelDoCadastro[] {
  if (idLevel === ADMIN) return NIVEIS;
  if (idLevel === PROFISSIONAL_NAPNE) {
    return NIVEIS.filter((nivel) => nivel.value === String(ESTUDANTE));
  }
  return [];
}

import { ESTUDANTE, PROFISSIONAL_NAPNE, ADMIN } from "@/consts";
import { PAPEIS_DO_FORMULARIO, temPapel, type Papeis } from "./papeis";

// Papéis que quem cadastra pode atribuir, como o POST /users do back: o
// administrador cria qualquer combinação válida e o NAPNE só o de estudante. O
// back recusa o resto; esta lista evita oferecer o que ele negaria.
export function papeisDoCadastro(roles?: Papeis): readonly number[] {
  if (temPapel(roles, ADMIN)) return PAPEIS_DO_FORMULARIO;
  if (temPapel(roles, PROFISSIONAL_NAPNE)) return [ESTUDANTE];
  return [];
}

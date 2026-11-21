import { ADMIN, PROFISSIONAL_NAPNE } from "@/consts";
import { temPapel, type Papeis } from "./papeis";

// Cada perfil cadastra pela própria página, como o back separa o POST /users do
// administrador e o POST /users/students do NAPNE. Conta com os dois papéis usa
// a do administrador.
export function rotaDoCadastro(roles: Papeis): string | null {
  if (temPapel(roles, ADMIN)) return "/admin/usuarios/cadastro";
  if (temPapel(roles, PROFISSIONAL_NAPNE)) return "/napne/usuarios/cadastro";
  return null;
}

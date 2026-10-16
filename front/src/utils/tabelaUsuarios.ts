import { getAllStudents } from '@/api/students';
import { getAllUsers } from '@/api/user';
import { ADMIN, ESTUDANTE } from '@/consts';
import type { StudentData } from '@/interfaces/StudentData';

// Só o administrador lista todos os usuários. Qualquer outro nível, inclusive
// sessão sem nível, recebe apenas os estudantes.
export function listarUsuariosDaTabela(idLevel?: number) {
  return idLevel === ADMIN ? getAllUsers() : getAllStudents();
}

// Troca na lista o usuário que a API devolveu depois de uma alteração. A
// resposta é o registro inteiro (mesmo select e CPF mascarado do GET /users),
// então a linha mostra também o que o back mexeu sozinho, como o limite de
// atendimento que some quando o NAPNE muda de nível ou os campos da fila
// quando o nível entra ou sai de estudante. Quem não está na lista não entra.
export function substituirUsuario(
  usuarios: StudentData[],
  atualizado: StudentData,
): StudentData[] {
  return usuarios.map((usuario) =>
    usuario.id === atualizado.id ? atualizado : usuario,
  );
}

// O relatório é só de estudante: para os outros níveis, GET /reports/:email
// responde 404. A tabela do administrador lista todos os usuários, então o
// botão de exportar depende do nível da linha.
export function podeExportarRelatorio(usuario: Pick<StudentData, 'id_level'>): boolean {
  return usuario.id_level === ESTUDANTE;
}

import { getAllStudents } from '@/api/students';
import { getAllUsers } from '@/api/user';
import { ADMIN, ESTUDANTE } from '@/consts';
import { temPapel, type Papeis } from '@/utils/papeis';
import type { StudentData } from '@/interfaces/StudentData';
import { nomeDoResponsavel } from '@/utils/responsavelPedagogico';
import { SITUACAO_PADRAO, type SituacaoDaLista } from '@/utils/filtroPorSituacao';

// Só o administrador lista todos os usuários. Qualquer outro papel, inclusive
// sessão sem papel, recebe apenas os estudantes. A situação (carência ou
// desativados) só existe para o administrador.
export function listarUsuariosDaTabela(
  roles?: Papeis,
  situacao: SituacaoDaLista = SITUACAO_PADRAO,
) {
  return temPapel(roles, ADMIN) ? getAllUsers(situacao) : getAllStudents();
}

// Troca na lista o usuário que a API devolveu depois de uma alteração. A
// resposta é o registro inteiro (mesmo select e CPF mascarado do GET /users),
// então a linha mostra também o que o back mexeu sozinho, como os campos da fila
// quando o papel de estudante entra ou sai. Quem não está na lista não entra.
export function substituirUsuario(
  usuarios: StudentData[],
  atualizado: StudentData,
): StudentData[] {
  return usuarios.map((usuario) =>
    usuario.id === atualizado.id ? atualizado : usuario,
  );
}

// O relatório é só de estudante: para os outros papéis, GET /reports/:email
// responde 404. A tabela do administrador lista todos os usuários, então o
// botão de exportar depende dos papéis da linha.
export function podeExportarRelatorio(usuario: Pick<StudentData, 'roles'>): boolean {
  return temPapel(usuario.roles, ESTUDANTE);
}

// A coluna do responsável pedagógico só vale para estudante. A tabela do
// administrador lista todos os usuários, e a linha de quem não é estudante fica
// vazia, em vez de mostrar "Responsável não atribuído" para uma conta que nunca
// terá responsável.
export function responsavelDaLinha(
  usuario: Pick<
    StudentData,
    'roles' | 'pedagogical_manager' | 'external_manager_name'
  >,
): string {
  return temPapel(usuario.roles, ESTUDANTE) ? nomeDoResponsavel(usuario) : '';
}

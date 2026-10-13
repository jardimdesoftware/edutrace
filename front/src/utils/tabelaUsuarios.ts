import { getAllStudents } from '@/api/students';
import { getAllUsers } from '@/api/user';
import { ADMIN, ESTUDANTE } from '@/consts';
import type { StudentData } from '@/interfaces/StudentData';

// Só o administrador lista todos os usuários. Qualquer outro nível, inclusive
// sessão sem nível, recebe apenas os estudantes.
export function listarUsuariosDaTabela(idLevel?: number) {
  return idLevel === ADMIN ? getAllUsers() : getAllStudents();
}

// O relatório é só de estudante: para os outros níveis, GET /reports/:email
// responde 404. A tabela do administrador lista todos os usuários, então o
// botão de exportar depende do nível da linha.
export function podeExportarRelatorio(usuario: Pick<StudentData, 'id_level'>): boolean {
  return usuario.id_level === ESTUDANTE;
}

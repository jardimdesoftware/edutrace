import type { StudentData } from '@/interfaces/StudentData';
import { listarUsuariosDaTabela } from './tabelaUsuarios';
import { errorAlertOptions } from './errorAlert';

// As telas do estudante levam só o id na URL. O Microsoft Clarity registra o
// endereço de cada página visitada, então e-mail, nome e CPF do estudante não
// podem ir na query string.
export function rotaDoEstudante(caminho: string, id?: number | string | null) {
  if (id === null || id === undefined || id === '') return caminho;
  return `${caminho}?id=${encodeURIComponent(String(id))}`;
}

// Resolve o usuário a partir do id da URL na mesma lista que a tabela da home
// exibe para o nível da sessão: o administrador procura entre todos os
// usuários, e os profissionais, entre os estudantes.
export async function buscarUsuarioPorId(
  id: string | null,
  idLevel?: number,
): Promise<StudentData | null> {
  const idNumerico = Number(id);
  if (!id || !Number.isInteger(idNumerico) || idNumerico <= 0) return null;

  const usuarios: StudentData[] = await listarUsuariosDaTabela(idLevel);
  return usuarios.find((usuario) => usuario.id === idNumerico) ?? null;
}

// Sem estudante, a tela não tem o que exibir: o id inválido, inexistente, fora
// da lista do nível da sessão ou a falha da API viram o alerta mostrado antes
// de voltar para a home. O front não distingue "não existe" de "sem acesso",
// porque a lista do profissional só traz estudantes.
export async function resolverEstudanteDaUrl(
  id: string | null,
  idLevel?: number,
): Promise<{ registro: StudentData } | { alerta: ReturnType<typeof errorAlertOptions> }> {
  let falha: unknown;
  const registro = await buscarUsuarioPorId(id, idLevel).catch((erro) => {
    console.error('Erro ao identificar o estudante:', erro);
    falha = erro;
    return null;
  });

  if (registro) return { registro };

  return {
    alerta: errorAlertOptions(
      'Estudante não encontrado',
      falha,
      'O estudante não existe ou você não tem acesso a ele.',
    ),
  };
}

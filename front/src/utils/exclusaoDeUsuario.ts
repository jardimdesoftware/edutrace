import { ADMIN } from '@/consts';
import type { StudentData } from '@/interfaces/StudentData';
import { temPapel, type UsuarioLogado } from './papeis';

// Mesmo prazo de USER_DELETION_GRACE_DAYS no back, que é quem apaga de vez.
export const DIAS_DE_CARENCIA = 7;

const DIA_EM_MS = 24 * 60 * 60 * 1000;

export const MOTIVO_PROPRIA_CONTA = 'Você não pode excluir a própria conta.';

export function estaMarcado(usuario: Pick<StudentData, 'deleted_at'>): boolean {
  return !!usuario.deleted_at;
}

// Dia em que o back apaga o usuário: a marcação mais a carência.
export function dataDaExclusao(marcadoEm: string): Date {
  return new Date(new Date(marcadoEm).getTime() + DIAS_DE_CARENCIA * DIA_EM_MS);
}

export function textoDaDesativacao(marcadoEm: string): string {
  const data = dataDaExclusao(marcadoEm).toLocaleDateString('pt-BR', {
    timeZone: 'America/Recife',
  });
  return `Desativação em ${data}`;
}

// A regra definitiva é do back (DELETE /users/:id é só do administrador, e
// recusa a própria conta e quem já está marcado). Aqui só decide se a lixeira
// aparece e se está ativa.
export function podeExcluir(
  usuario: UsuarioLogado | null | undefined,
  alvo: Pick<StudentData, 'id' | 'deleted_at'>,
): boolean {
  return (
    temPapel(usuario?.roles, ADMIN) &&
    usuario?.sub !== alvo.id &&
    !estaMarcado(alvo)
  );
}

export function podeRestaurar(
  usuario: UsuarioLogado | null | undefined,
  alvo: Pick<StudentData, 'deleted_at'>,
): boolean {
  return temPapel(usuario?.roles, ADMIN) && estaMarcado(alvo);
}

export function motivoDaLixeiraDesativada(
  usuario: UsuarioLogado | null | undefined,
  alvo: Pick<StudentData, 'id'>,
): string | null {
  return usuario?.sub === alvo.id ? MOTIVO_PROPRIA_CONTA : null;
}

// A janela de 10 minutos é do servidor. O navegador só guarda o fim que o back
// devolveu, para decidir se mostra o campo de senha; se o back discordar, ele
// responde 401 e o campo volta.
export function janelaDeSenhaAberta(
  ate: string | null | undefined,
  agora: Date,
): boolean {
  if (!ate) return false;
  const fim = new Date(ate).getTime();
  return Number.isFinite(fim) && fim > agora.getTime();
}

export function corpoDaExclusao(
  senha: string,
  lembrar: boolean,
): { currentPassword?: string; remember?: boolean } {
  if (!senha) return {};
  return lembrar ? { currentPassword: senha, remember: true } : { currentPassword: senha };
}

// Desativado é quem passou da carência com dados: continua guardado e só o
// administrador o vê, no filtro de desativados.
export function estaDesativado(usuario: Pick<StudentData, 'deactivated_at'>): boolean {
  return !!usuario.deactivated_at;
}

function diaDoFimDaCarencia(agora: Date): string {
  return dataDaExclusao(agora.toISOString()).toLocaleDateString('pt-BR', {
    timeZone: 'America/Recife',
  });
}

// O aviso da lixeira diz o que vai acontecer com a conta no fim da carência.
// temDados vem da prévia do back; null é a prévia que falhou, e o aviso fala dos
// dois casos.
export function textoDoAvisoDaLixeira(
  alvo: Pick<StudentData, 'full_name' | 'email'>,
  temDados: boolean | null,
  agora: Date,
): string {
  const data = diaDoFimDaCarencia(agora);
  const abertura = `A conta de "${alvo.full_name}" (${alvo.email}) perde o acesso agora e fica com a desativação pendente.`;
  const fechamento = 'Até lá, você pode restaurar o acesso.';

  if (temDados === true) {
    return `${abertura} Em ${data} ela será desativada, e os dados serão mantidos. ${fechamento}`;
  }

  if (temDados === false) {
    return `${abertura} Em ${data} ela será excluída, porque não tem dados cadastrados. Se ganhar dados até lá, será desativada. ${fechamento}`;
  }

  return `${abertura} Em ${data} ela será desativada, ou excluída se não tiver dados cadastrados. ${fechamento}`;
}

export function textoDoSucessoDaLixeira(marcadoEm: string): string {
  const data = dataDaExclusao(marcadoEm).toLocaleDateString('pt-BR', {
    timeZone: 'America/Recife',
  });
  return `Em ${data}, a conta será desativada, ou excluída se não tiver dados cadastrados. Até lá, você pode restaurar o acesso.`;
}

import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
} from '@/consts';
import type {
  PedagogicalManagerOption,
  PedagogicalManagerPayload,
} from '@/interfaces/PedagogicalManager';
import type { StudentData } from '@/interfaces/StudentData';

export const SEM_RESPONSAVEL = 'Responsável não atribuído';

// Mesmo limite do nome do responsável externo no back.
export const RESPONSAVEL_NOME_MAX = 150;

export type TipoResponsavel = PedagogicalManagerPayload['kind'];

export type RascunhoResponsavel = {
  tipo: TipoResponsavel;
  servidorId: string;
  nome: string;
  telefone: string;
  cpf: string;
};

export type CorpoDoResponsavelResult =
  | { ok: true; data: PedagogicalManagerPayload }
  | { ok: false; error: string };

type ResponsavelDoEstudante = Pick<
  StudentData,
  | 'pedagogical_manager'
  | 'external_manager_name'
  | 'external_manager_phone'
  | 'external_manager_cpf'
>;

const ROTULO_DO_NIVEL: Partial<Record<number, string>> = {
  [PROFISSIONAL_EDUCACAO]: 'Profissional da Educação',
  [PROFISSIONAL_NAPNE]: 'Profissional NAPNE',
};

// Servidor ou pessoa externa; os dois não coexistem. Sem nenhum, o texto que as
// telas já mostravam para o estudante sem responsável.
export function nomeDoResponsavel(
  estudante?: Pick<ResponsavelDoEstudante, 'pedagogical_manager' | 'external_manager_name'> | null,
): string {
  return (
    estudante?.pedagogical_manager?.full_name ||
    estudante?.external_manager_name?.trim() ||
    SEM_RESPONSAVEL
  );
}

// A regra definitiva é do back (Administrador e NAPNE). Aqui só decide se a
// seção aparece; o responsável é de estudante, e a lista do administrador
// também traz os outros níveis.
export function podeDefinirResponsavel(
  usuario?: { id_level: number } | null,
  estudante?: Pick<StudentData, 'id_level'> | null,
): boolean {
  return (
    (usuario?.id_level === ADMIN || usuario?.id_level === PROFISSIONAL_NAPNE) &&
    estudante?.id_level === ESTUDANTE
  );
}

// Dois servidores podem ter o mesmo nome; o nível os distingue na lista.
export function rotuloDaOpcao(opcao: PedagogicalManagerOption): string {
  const nivel = ROTULO_DO_NIVEL[opcao.id_level];
  return nivel ? `${opcao.full_name} (${nivel})` : opcao.full_name;
}

// O CPF do externo chega mascarado, então não volta para o campo: quem edita a
// pessoa externa digita o CPF de novo.
export function rascunhoInicial(estudante: ResponsavelDoEstudante): RascunhoResponsavel {
  const servidor = estudante.pedagogical_manager;
  const externo = estudante.external_manager_name?.trim();

  return {
    tipo: !servidor && externo ? 'EXTERNAL' : 'SERVER',
    servidorId: servidor ? String(servidor.id) : '',
    nome: externo ?? '',
    telefone: externo ? (estudante.external_manager_phone ?? '') : '',
    cpf: '',
  };
}

const SEPARADORES_DE_TELEFONE = /[\s().-]/g;
const SEPARADORES_DE_CPF = /[\s.-]/g;
const SOMENTE_DIGITOS = /^[0-9]*$/;
const TELEFONE_COM_DDD = /^[0-9]{10,11}$/;
const CPF_COM_DIGITOS = /^[0-9]{11}$/;

// Tira só a pontuação usual do campo. Letra ou qualquer outro símbolo
// permanece e reprova a validação, em vez de ser descartado em silêncio.
function semSeparadores(texto: string, separadores: RegExp): string {
  const limpo = texto.replace(separadores, '');
  return SOMENTE_DIGITOS.test(limpo) ? limpo : texto;
}

function corpoDoExterno(rascunho: RascunhoResponsavel): CorpoDoResponsavelResult {
  const nome = rascunho.nome.trim();
  if (!nome) {
    return { ok: false, error: 'Informe o nome da pessoa responsável.' };
  }
  if (nome.length > RESPONSAVEL_NOME_MAX) {
    return {
      ok: false,
      error: `O nome deve ter no máximo ${RESPONSAVEL_NOME_MAX} caracteres.`,
    };
  }

  const phone = semSeparadores(rascunho.telefone, SEPARADORES_DE_TELEFONE);
  if (!TELEFONE_COM_DDD.test(phone)) {
    return { ok: false, error: 'Informe o telefone com DDD, com 10 ou 11 dígitos.' };
  }

  const cpf = semSeparadores(rascunho.cpf, SEPARADORES_DE_CPF);
  if (!CPF_COM_DIGITOS.test(cpf)) {
    return { ok: false, error: 'Informe o CPF com 11 dígitos.' };
  }

  return { ok: true, data: { kind: 'EXTERNAL', name: nome, phone, cpf } };
}

// Só o tipo escolhido vai no corpo; o que ficou digitado nos outros campos é
// descartado. O CPF é conferido pelo back (dígitos verificadores incluídos).
export function montarCorpoDoResponsavel(
  rascunho: RascunhoResponsavel,
): CorpoDoResponsavelResult {
  switch (rascunho.tipo) {
    case 'NONE':
      return { ok: true, data: { kind: 'NONE' } };
    case 'EXTERNAL':
      return corpoDoExterno(rascunho);
    case 'SERVER': {
      const texto = rascunho.servidorId.trim();
      const id = SOMENTE_DIGITOS.test(texto) ? Number(texto) : NaN;
      if (!Number.isSafeInteger(id) || id <= 0) {
        return { ok: false, error: 'Escolha o servidor responsável.' };
      }
      return { ok: true, data: { kind: 'SERVER', user_id: id } };
    }
  }
}

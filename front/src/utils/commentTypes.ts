import type { NewCommentPayload } from '../api/comments';
import type { CommentType } from '../interfaces/CommentData';
import {
  CONTROLE_EM_TEXTO,
  MARCAS_DEMAIS,
  removerControlesDeTexto,
} from './caracteres';

// A anotação é o padrão e vem primeiro: é a ordem do grupo de rádio.
export const TIPOS_DE_ANOTACAO: readonly CommentType[] = [
  'NOTE',
  'CLASS_COUNCIL_REPORT',
];

export const ROTULO_DO_TIPO: Record<CommentType, string> = {
  NOTE: 'Anotação',
  CLASS_COUNCIL_REPORT: 'Relatório multiprofissional',
};

// Mesmos números de COMMENT_MAX_LENGTH no back (back/src/constants.ts).
export const LIMITE_DO_TIPO: Record<CommentType, number> = {
  NOTE: 1000,
  CLASS_COUNCIL_REPORT: 10000,
};

// O back conta em unidades UTF-16 (length do string), igual ao maxLength do
// textarea; por isso o tamanho é o texto como está no campo, sem trim.
export function erroDeTamanho(texto: string, tipo: CommentType): string {
  const limite = LIMITE_DO_TIPO[tipo];
  if (texto.length <= limite) return '';

  return `O texto tem ${texto.length} caracteres, acima do limite de ${limite} para ${ROTULO_DO_TIPO[tipo].toLowerCase()}.`;
}

// O front envia o texto com trim, que também tira \v e \f das pontas, e o back
// valida o que chega (o DTO das anotações não faz trim); por isso as checagens
// de caractere são sobre o texto que vai.
export function erroDeCaractere(texto: string): string {
  if (!CONTROLE_EM_TEXTO.test(texto.trim())) return '';

  return 'O texto não pode ter caracteres de controle, exceto tabulação e quebra de linha.';
}

export function erroDeMarcas(texto: string): string {
  if (!MARCAS_DEMAIS.test(texto.trim())) return '';

  return 'O texto não pode ter mais de 30 acentos ou marcas seguidos.';
}

// O que impede de publicar ou salvar: o tamanho primeiro, depois os caracteres
// de controle e por fim as marcas combinantes em excesso.
export function erroDeTexto(texto: string, tipo: CommentType): string {
  return erroDeTamanho(texto, tipo) || erroDeCaractere(texto) || erroDeMarcas(texto);
}

export const AVISO_DE_TEXTO_LIMPO =
  'Removemos caracteres invisíveis que o sistema não aceita mais.';

interface TextoParaEditar {
  texto: string;
  limpou: boolean;
}

// Anotações gravadas antes de o back recusar caractere de controle podem tê-los
// no texto, e o autor não conseguiria salvar a edição. Ao abrir a edição, \v e
// \f (que o leitor via como quebra de linha) viram quebra de linha, e os demais
// controles e o surrogate solto saem. A tabulação e as quebras de linha ficam.
export function textoParaEditar(gravado: string): TextoParaEditar {
  const texto = removerControlesDeTexto(gravado.replace(/[\v\f]/g, '\n'));

  return { texto, limpou: texto !== gravado };
}

interface DadosDaNovaAnotacao {
  texto: string;
  idUsuario: number;
  tipo: CommentType;
  avisarPorEmail: boolean;
}

// O autor vem do token no back; o tipo vai sempre, mesmo sendo o padrão, e
// só existe na criação: o PATCH recusa o campo.
export function montarNovaAnotacao({
  texto,
  idUsuario,
  tipo,
  avisarPorEmail,
}: DadosDaNovaAnotacao): NewCommentPayload {
  return {
    comment: texto.trim(),
    id_user: idUsuario,
    type: tipo,
    notify_by_email: avisarPorEmail,
  };
}

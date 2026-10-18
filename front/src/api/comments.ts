import type {
  CommentData,
  CommentPage,
  CommentQuery,
  CommentType,
} from "@/interfaces/CommentData";
import { apiRequest } from "@/services/http";
import { COMMENT_EDIT_FIELDS, pickFields } from "@/utils/editPayload";

// O autor da anotação vem do token no backend, por isso o payload leva apenas
// o texto, o destinatário, o tipo (ausente vale NOTE) e a opção de aviso por
// e-mail.
export type NewCommentPayload = {
  comment: string;
  id_user: number;
  type?: CommentType;
  notify_by_email?: boolean;
};

// O tipo é escolhido na criação e não muda: o PATCH não o aceita.
export type EditCommentPayload = {
  comment: string;
  notify_by_email?: boolean;
};

// Uma página das anotações do estudante, com os filtros aplicados no servidor.
// A busca vai em URLSearchParams, que codifica &, =, # e % do texto digitado.
export async function listComments(
  id_user: number,
  query: CommentQuery,
): Promise<CommentPage> {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) params.set(name, String(value));
  }
  const search = params.toString();

  return apiRequest(
    `/comments/${encodeURIComponent(String(id_user))}${search ? `?${search}` : ''}`,
  );
}

export async function getAllCommentsByIdUser(id_user: number) {
  return apiRequest(`/comments/${id_user}`);
}

export async function postComment(payload: NewCommentPayload): Promise<CommentData> {
  return apiRequest('/comments', {
    method: 'POST',
    body: payload,
  });
}

export async function updateComment(
  id: number,
  payload: EditCommentPayload,
): Promise<CommentData> {
  return apiRequest(`/comments/${id}`, {
    method: 'PATCH',
    body: pickFields(payload, COMMENT_EDIT_FIELDS),
  });
}

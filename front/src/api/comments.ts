import type { CommentData } from "@/interfaces/CommentData";
import { apiRequest } from "@/services/http";

// O autor da anotação vem do token no backend, por isso o payload leva apenas
// o texto, o destinatário e a opção de aviso por e-mail.
export type NewCommentPayload = {
  comment: string;
  id_user: number;
  notify_by_email?: boolean;
};

export type EditCommentPayload = {
  comment: string;
  notify_by_email?: boolean;
};

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
    body: payload,
  });
}

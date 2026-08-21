import { CommentData } from "@/interfaces/CommentData";
import { apiRequest } from "@/services/http";

export async function getAllCommentsByIdUser(id_user: number) {
  return apiRequest(`/comments/${id_user}`);
}

export async function postComment(commentData: CommentData): Promise<CommentData> {
  return apiRequest('/comments', {
    method: 'POST',
    body: commentData,
  });
}

import { AuthenticatedRequest } from 'src/comments/types/express';
import { RevisionAuthor } from './form-revisions.service';

// O autor da versão é quem está na sessão, e não um campo do corpo.
export function authorOf(request: AuthenticatedRequest): RevisionAuthor {
  return { id: request.user.sub, name: request.user.name };
}

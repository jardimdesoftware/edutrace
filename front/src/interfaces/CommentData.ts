export type CommentType = 'NOTE' | 'CLASS_COUNCIL_REPORT';

export interface CommentEditData {
    id: number;
    comment: string;
    created_at: Date;
}

export interface CommentData {
    id: number;
    comment: string;
    type: CommentType;
    id_user: number;
    id_author: number;
    author_name: string;
    author_level?: number | null;
    created_at: Date;
    updated_at?: Date | null;
    edits?: CommentEditData[];
}

export interface CommentAuthor {
    id: number;
    name: string;
}

// Query de GET /comments/:id_user. Cada chave é um parâmetro do contrato; a API
// recusa com 400 qualquer parâmetro fora desta lista.
export interface CommentQuery {
    q?: string;
    author?: number;
    area?: number;
    type?: CommentType;
    from?: string;
    to?: string;
    edited?: boolean;
    cursor?: number;
    limit?: number;
}

// Resposta de GET /comments/:id_user: uma página de anotações (da mais nova
// para a mais antiga) e os totais.
export interface CommentPage {
    items: CommentData[];
    next_cursor: number | null;
    total: number;
    overall: number;
    authors: CommentAuthor[];
}

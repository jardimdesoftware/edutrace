import type { CaseStudy, CaseStudyPayload } from "@/interfaces/CaseStudy";
import { ApiError, apiRequest } from "@/services/http";

function caminhoDoEstudante(email: string) {
  return `/case-studies/${encodeURIComponent(email)}`;
}

// 404 é o estudante sem estudo de caso, um estado normal da tela. Qualquer
// outra falha (403, 500, rede) continua sendo erro.
export async function getCaseStudy(email: string): Promise<CaseStudy | null> {
  try {
    return await apiRequest(caminhoDoEstudante(email));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function createCaseStudy(email: string, sections: CaseStudyPayload) {
  return apiRequest('/case-studies', {
    method: 'POST',
    body: { student_email: email, ...sections },
  });
}

export async function updateCaseStudy(email: string, sections: CaseStudyPayload) {
  return apiRequest(caminhoDoEstudante(email), {
    method: 'PATCH',
    body: sections,
  });
}

export async function deleteCaseStudy(email: string) {
  return apiRequest(caminhoDoEstudante(email), { method: 'DELETE' });
}

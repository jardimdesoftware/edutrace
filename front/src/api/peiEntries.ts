import type { NewPeiEntryPayload, PeiEntry, PeiEntryUpdatePayload } from "@/interfaces/PeiEntry";
import { apiRequest } from "@/services/http";

function caminhoDoRegistro(id: number) {
  return `/pei-entries/${id}`;
}

// Do semestre mais recente para o mais antigo, e por disciplina dentro do
// semestre; vazia quando o estudante não tem registro do PEI.
export async function listPeiEntries(email: string): Promise<PeiEntry[]> {
  return apiRequest(`/pei-entries/${encodeURIComponent(email)}`);
}

// O corpo leva o e-mail do estudante, o semestre e a disciplina junto do
// conteúdo (ver montarCorpoDeCriacao).
export async function createPeiEntry(corpo: NewPeiEntryPayload) {
  return apiRequest("/pei-entries", { method: "POST", body: corpo });
}

// Semestre e disciplina não mudam depois que o registro é criado, então o PATCH
// só leva o conteúdo.
export async function updatePeiEntry(id: number, conteudo: PeiEntryUpdatePayload) {
  return apiRequest(caminhoDoRegistro(id), { method: "PATCH", body: conteudo });
}

export async function deletePeiEntry(id: number) {
  return apiRequest(caminhoDoRegistro(id), { method: "DELETE" });
}

import type { StudentData } from "@/interfaces/StudentData";
import { apiRequest } from "@/services/http";

export async function getAllStudents() {
  return apiRequest('/students');
}

export async function getStudentByEmail(email: string) {
  return apiRequest(`/students/${encodeURIComponent(email)}`);
}

export async function assumirAtendimento(email: string): Promise<StudentData> {
  return apiRequest(`/students/${encodeURIComponent(email)}/service/assume`, {
    method: 'POST',
  });
}

export async function atualizarCursoDoEstudante(
  email: string,
  course: string,
): Promise<StudentData> {
  return apiRequest(`/students/${encodeURIComponent(email)}/course`, {
    method: 'PATCH',
    body: { course },
  });
}

export async function encerrarAtendimento(email: string): Promise<StudentData> {
  return apiRequest(`/students/${encodeURIComponent(email)}/service/close`, {
    method: 'POST',
  });
}

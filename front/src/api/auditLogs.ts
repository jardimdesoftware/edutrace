import { apiRequest } from "@/services/http";
import type {
  ExportacaoDaAuditoria,
  FiltrosDaAuditoria,
  PaginaDaAuditoria,
} from "@/utils/auditoria";
import { consultaDaAuditoria } from "@/utils/auditoria";

export async function exportAuditLogs(
  filtros: FiltrosDaAuditoria,
): Promise<ExportacaoDaAuditoria> {
  return apiRequest(`/audit-logs/export${consultaDaAuditoria({ ...filtros, page: undefined })}`);
}

export type DocumentoBaixado = "StudentReport" | "AeeAgenda";

export async function listAuditLogs(
  filtros: FiltrosDaAuditoria,
): Promise<PaginaDaAuditoria> {
  return apiRequest(`/audit-logs${consultaDaAuditoria(filtros)}`);
}

// O PDF é montado no navegador, então o download é registrado antes de salvar o
// arquivo: se o registro falhar, o arquivo não é salvo.
export async function registrarDownload(
  entity: DocumentoBaixado,
  entityId?: number,
): Promise<void> {
  await apiRequest("/audit-logs/downloads", {
    method: "POST",
    body: entityId === undefined ? { entity } : { entity, entity_id: entityId },
  });
}

import type { ReportsData } from '@/interfaces/ReportsData';

export function relatorioVazio(report: ReportsData): boolean {
  return !report.screening && !report.plansEducation;
}

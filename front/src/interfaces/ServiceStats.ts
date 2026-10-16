import type { ServiceStatus } from "./StudentData";

export interface ProfessionalLoad {
  id: number;
  full_name: string;
  in_service: number;
  capacity: number | null;
  free: number | null;
}

export interface ServiceQueue {
  size: number;
  oldest_queued_at: string | null;
}

export interface ServiceStats {
  totals: Record<ServiceStatus, number>;
  professionals: ProfessionalLoad[];
  queue: ServiceQueue;
}

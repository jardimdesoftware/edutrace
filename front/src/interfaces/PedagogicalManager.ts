export interface PedagogicalManagerOption {
  id: number;
  full_name: string;
  roles: number[];
}

export type PedagogicalManagerPayload =
  | { kind: "SERVER"; user_id: number }
  | { kind: "EXTERNAL"; name: string; phone: string; cpf: string }
  | { kind: "NONE" };

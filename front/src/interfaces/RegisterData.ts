export interface RegisterData {
    full_name: string;
    cpf: string;
    email: string;
    id_level?: number;
    roles?: number[];
    affliation?: string;
    enrollment_number?: string;
    course?: string;
}
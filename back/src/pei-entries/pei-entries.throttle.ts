// Registros do PEI criados por hora de cada usuário.
export const PEI_ENTRY_CREATE_RATE_LIMIT = 60;

// Janela do limite: 1 hora, em milissegundos.
export const PEI_ENTRY_CREATE_RATE_TTL_MS = 3_600_000;

// Limite do POST /pei-entries, aplicado com @Throttle sobre o ThrottlerModule do
// AppModule. A rota é aberta a todo Profissional da Educação, e o teto de 300
// registros ativos por estudante não impede uma sessão comprometida de criar e
// excluir registros em volume (a exclusão é lógica e as linhas ficam no banco),
// então o limite geral de 300 por minuto deixaria a tabela crescer sem freio.
// São 60 registros por hora, contados por usuário da sessão.
export const PEI_ENTRY_CREATE_THROTTLE = {
  default: {
    limit: PEI_ENTRY_CREATE_RATE_LIMIT,
    ttl: PEI_ENTRY_CREATE_RATE_TTL_MS,
  },
};

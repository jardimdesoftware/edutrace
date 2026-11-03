// Cadastros por hora de cada usuário quando USER_CREATE_RATE_LIMIT não está
// definida.
export const USER_CREATE_RATE_LIMIT_DEFAULT = 60;

// Limite do POST /users, aplicado com @Throttle sobre o ThrottlerModule do
// AppModule. Cada cadastro cria uma conta e dispara o e-mail de ativação, e a
// rota é aberta ao Profissional NAPNE além do administrador, então o limite
// geral de 300 por minuto deixaria uma sessão comprometida cadastrar contas e
// enviar e-mails em massa. O padrão é de 60 cadastros por hora, contados por
// usuário da sessão. USER_CREATE_RATE_LIMIT e USER_CREATE_RATE_LIMIT_TTL_MS
// substituem o limite e a janela, para testes de carga.
export const USER_CREATE_THROTTLE = {
  default: {
    limit:
      Number(process.env.USER_CREATE_RATE_LIMIT) ||
      USER_CREATE_RATE_LIMIT_DEFAULT,
    ttl: Number(process.env.USER_CREATE_RATE_LIMIT_TTL_MS) || 3_600_000,
  },
};

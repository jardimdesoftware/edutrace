import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const COMMON_PASSWORDS_FILE = join(__dirname, 'data', 'common-passwords.txt');
const PWNED_PASSWORDS_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const PWNED_PASSWORDS_TIMEOUT_MS = 3000;

export const COMPROMISED_PASSWORD_MESSAGE =
  'Esta senha é muito comum ou já apareceu em vazamentos de dados. Escolha outra.';

// A lista é lida quando o módulo é carregado: se o arquivo não chegar ao build,
// o back não sobe, em vez de passar a aceitar qualquer senha sem aviso.
const COMMON_PASSWORDS = new Set(
  readFileSync(COMMON_PASSWORDS_FILE, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')),
);

// A lista está em minúsculas, então "Password123" é recusada como
// "password123". O seed também a usa para a senha do administrador inicial.
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

// Recusa senhas comuns e senhas que já vazaram (ASVS 5.0, 6.2.4 e 6.2.12) em
// todo fluxo que grava uma senha escolhida pelo usuário. Quem chama valida a
// credencial do fluxo (senha atual, código ou token) antes, para que uma
// requisição sem credencial não dispare consulta ao serviço externo.
@Injectable()
export class CompromisedPasswordService {
  private readonly logger = new Logger(CompromisedPasswordService.name);

  async assertNotCompromised(password: string): Promise<void> {
    if (isCommonPassword(password) || (await this.isBreached(password))) {
      throw new BadRequestException(COMPROMISED_PASSWORD_MESSAGE);
    }
  }

  // Pwned Passwords por k-anonimidade: só os 5 primeiros caracteres do SHA-1
  // saem do servidor, e a comparação com o restante é feita aqui. O SHA-1 é o
  // formato exigido pela API e não é usado para guardar senha. Add-Padding
  // completa a resposta com registros falsos (contagem 0), para que o tamanho
  // dela não revele o prefixo consultado.
  //
  // Se a API não responder, vale só a lista local: a indisponibilidade de um
  // serviço externo não pode impedir ninguém de definir ou trocar a senha.
  private async isBreached(password: string): Promise<boolean> {
    const hash = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
      const response = await fetch(`${PWNED_PASSWORDS_RANGE_URL}${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(PWNED_PASSWORDS_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const body = await response.text();

      return body.split('\n').some((line) => {
        const [lineSuffix, count] = line.trim().split(':');
        return lineSuffix === suffix && Number(count) > 0;
      });
    } catch (error) {
      this.logger.warn(
        `Pwned Passwords indisponível, senha verificada só pela lista local: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}

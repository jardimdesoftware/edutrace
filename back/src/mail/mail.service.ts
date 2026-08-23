import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT);
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return this.transporter;
  }

  async sendAccountLockedNotice(to: string, lockedUntil: Date): Promise<void> {
    const horario = lockedUntil.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: 'EduTrace - Acesso temporariamente bloqueado',
      text: [
        'Olá!',
        '',
        'Registramos tentativas de acesso com senha incorreta na sua conta do EduTrace.',
        '',
        `Por segurança, o acesso ficará bloqueado até ${horario} (horário de Brasília). Depois disso, o login volta a funcionar sozinho.`,
        '',
        'Se não foi você, redefina sua senha assim que possível pela opção "Esqueci minha senha", que continua disponível durante o bloqueio.',
      ].join('\n'),
      html: [
        '<p>Olá!</p>',
        '<p>Registramos tentativas de acesso com senha incorreta na sua conta do EduTrace.</p>',
        `<p>Por segurança, o acesso ficará bloqueado até <strong>${horario}</strong> (horário de Brasília). Depois disso, o login volta a funcionar sozinho.</p>`,
        '<p>Se não foi você, redefina sua senha assim que possível pela opção "Esqueci minha senha", que continua disponível durante o bloqueio.</p>',
      ].join(''),
    });
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: 'EduTrace - Código de recuperação de senha',
      text: `Olá!\n\nRecebemos uma solicitação para redefinir sua senha no EduTrace.\n\nSeu código de verificação é: ${code}\n\nEle expira em 15 minutos.\n\nSe você não solicitou a redefinição, ignore este e-mail.`,
      html: `<p>Olá!</p><p>Recebemos uma solicitação para redefinir sua senha no EduTrace.</p><p>Seu código de verificação é: <strong>${code}</strong></p><p>Ele expira em 15 minutos.</p><p>Se você não solicitou a redefinição, ignore este e-mail.</p>`,
    });
  }
}

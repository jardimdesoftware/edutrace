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

  // Aviso de vínculo e desvínculo da Conta Google usada no "Entrar com o
  // Google". Vincular acrescenta um meio de entrar na conta, então o dono
  // precisa saber quando isso acontece.
  async sendGoogleAccountLinkNotice(
    to: string,
    linked: boolean,
  ): Promise<void> {
    const resumo = linked
      ? 'Uma Conta Google foi vinculada à sua conta do EduTrace. A partir de agora, o botão "Entrar com o Google" abre a sua conta.'
      : 'A Conta Google foi desvinculada da sua conta do EduTrace. O botão "Entrar com o Google" deixa de abrir a sua conta.';
    const orientacao = linked
      ? 'Se não foi você, desvincule a Conta Google em "Alterar meus dados" e troque sua senha.'
      : 'Se não foi você, troque sua senha em "Alterar meus dados".';

    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: linked
        ? 'EduTrace - Conta Google vinculada'
        : 'EduTrace - Conta Google desvinculada',
      text: ['Olá!', '', resumo, '', orientacao].join('\n'),
      html: ['<p>Olá!</p>', `<p>${resumo}</p>`, `<p>${orientacao}</p>`].join(
        '',
      ),
    });
  }

  async sendNewCommentNotice(to: string): Promise<void> {
    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: 'EduTrace - Nova anotação multiprofissional',
      text: [
        'Olá!',
        '',
        'Um profissional registrou uma nova anotação multiprofissional sobre você no EduTrace.',
        '',
        'Acesse o sistema para ler a anotação.',
      ].join('\n'),
      html: [
        '<p>Olá!</p>',
        '<p>Um profissional registrou uma nova anotação multiprofissional sobre você no EduTrace.</p>',
        '<p>Acesse o sistema para ler a anotação.</p>',
      ].join(''),
    });
  }

  async sendUpdatedCommentNotice(to: string): Promise<void> {
    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: 'EduTrace - Anotação multiprofissional atualizada',
      text: [
        'Olá!',
        '',
        'Um profissional atualizou uma anotação multiprofissional sobre você no EduTrace.',
        '',
        'Acesse o sistema para ler a versão atual e o histórico de edição.',
      ].join('\n'),
      html: [
        '<p>Olá!</p>',
        '<p>Um profissional atualizou uma anotação multiprofissional sobre você no EduTrace.</p>',
        '<p>Acesse o sistema para ler a versão atual e o histórico de edição.</p>',
      ].join(''),
    });
  }

  async sendAccountActivationLink(
    to: string,
    link: string,
    expiresAt: Date,
  ): Promise<void> {
    const horario = expiresAt.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: 'EduTrace - Defina sua senha de acesso',
      text: [
        'Olá!',
        '',
        'Uma conta foi criada para você no EduTrace. Para acessar, defina sua senha pelo link abaixo:',
        '',
        link,
        '',
        `O link pode ser usado uma única vez e vale até ${horario} (horário de Brasília). Depois disso, use a opção "Esqueci minha senha" na tela de login.`,
        '',
        'Se você não esperava este e-mail, ignore-o.',
      ].join('\n'),
      html: [
        '<p>Olá!</p>',
        '<p>Uma conta foi criada para você no EduTrace. Para acessar, defina sua senha pelo link abaixo:</p>',
        `<p><a href="${link}">Definir minha senha</a></p>`,
        `<p>O link pode ser usado uma única vez e vale até <strong>${horario}</strong> (horário de Brasília). Depois disso, use a opção "Esqueci minha senha" na tela de login.</p>`,
        '<p>Se você não esperava este e-mail, ignore-o.</p>',
      ].join(''),
    });
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: 'EduTrace - Código de recuperação de senha',
      text: `Olá!\n\nRecebemos uma solicitação para redefinir sua senha no EduTrace.\n\nSeu código de verificação é: ${code}\n\nEle expira em até 15 minutos.\n\nSe você não solicitou a redefinição, ignore este e-mail.`,
      html: `<p>Olá!</p><p>Recebemos uma solicitação para redefinir sua senha no EduTrace.</p><p>Seu código de verificação é: <strong>${code}</strong></p><p>Ele expira em até 15 minutos.</p><p>Se você não solicitou a redefinição, ignore este e-mail.</p>`,
    });
  }
}

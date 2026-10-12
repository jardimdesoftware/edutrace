import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from 'src/mail/mail.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('MailService', () => {
  let service: MailService;
  let sendMail: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user@test.com';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.MAIL_FROM = 'EduTrace <nao-responda@test.com>';

    sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendNewCommentNotice', () => {
    it('should send the notice without the note content', async () => {
      await service.sendNewCommentNotice('estudante@test.com');

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'EduTrace <nao-responda@test.com>',
          to: 'estudante@test.com',
          subject: 'EduTrace - Nova anotação multiprofissional',
          text: expect.stringContaining('nova anotação multiprofissional'),
          html: expect.stringContaining('nova anotação multiprofissional'),
        }),
      );
    });

    it('should not interpolate any data into the message', async () => {
      await service.sendNewCommentNotice('estudante@test.com');
      await service.sendNewCommentNotice('outro@test.com');

      const [first] = sendMail.mock.calls[0] as [{ text: string; html: string }];
      const [second] = sendMail.mock.calls[1] as [
        { text: string; html: string },
      ];

      expect(first.text).toBe(second.text);
      expect(first.html).toBe(second.html);
    });

    it('should propagate errors from sendMail', async () => {
      sendMail.mockRejectedValue(new Error('SMTP indisponível'));

      await expect(
        service.sendNewCommentNotice('estudante@test.com'),
      ).rejects.toThrow('SMTP indisponível');
    });
  });

  describe('sendUpdatedCommentNotice', () => {
    it('should send the update notice without the note content', async () => {
      await service.sendUpdatedCommentNotice('estudante@test.com');

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'estudante@test.com',
          subject: 'EduTrace - Anotação multiprofissional atualizada',
          text: expect.stringContaining('atualizou uma anotação'),
          html: expect.stringContaining('atualizou uma anotação'),
        }),
      );
    });
  });

  describe('sendPasswordResetCode', () => {
    it('should create the transporter with the SMTP environment variables', async () => {
      await service.sendPasswordResetCode('user@test.com', '123456');

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'smtp-user@test.com',
          pass: 'smtp-pass',
        },
      });
    });

    it('should use a secure connection when the SMTP port is 465', async () => {
      process.env.SMTP_PORT = '465';

      await service.sendPasswordResetCode('user@test.com', '123456');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ port: 465, secure: true }),
      );
    });

    it('should reuse the same transporter across calls', async () => {
      await service.sendPasswordResetCode('user@test.com', '123456');
      await service.sendPasswordResetCode('user@test.com', '654321');

      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledTimes(2);
    });

    it('should send the email with the code in the body', async () => {
      await service.sendPasswordResetCode('user@test.com', '123456');

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'EduTrace <nao-responda@test.com>',
          to: 'user@test.com',
          subject: 'EduTrace - Código de recuperação de senha',
          text: expect.stringContaining('123456'),
          html: expect.stringContaining('123456'),
        }),
      );
    });

    // O código pedido dentro da janela de tentativas herda o prazo dela, então
    // pode valer menos de 15 minutos.
    it('should say the code lasts up to fifteen minutes', async () => {
      await service.sendPasswordResetCode('user@test.com', '123456');

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Ele expira em até 15 minutos.'),
          html: expect.stringContaining('Ele expira em até 15 minutos.'),
        }),
      );
    });

    it('should propagate errors from sendMail', async () => {
      sendMail.mockRejectedValue(new Error('SMTP indisponível'));

      await expect(
        service.sendPasswordResetCode('user@test.com', '123456'),
      ).rejects.toThrow('SMTP indisponível');
    });
  });

  describe('sendAccountActivationLink', () => {
    const link =
      'https://edutrace.example.com/definir-senha#token=abc_123-XYZ';
    const expiresAt = new Date('2026-10-02T15:00:00.000Z');

    it('should send the link and its deadline in Brasília time', async () => {
      await service.sendAccountActivationLink('novo@test.com', link, expiresAt);

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'EduTrace <nao-responda@test.com>',
          to: 'novo@test.com',
          subject: 'EduTrace - Defina sua senha de acesso',
          text: expect.stringContaining(link),
          html: expect.stringContaining(`href="${link}"`),
        }),
      );

      const [message] = sendMail.mock.calls[0] as [
        { text: string; html: string },
      ];
      expect(message.text).toContain('02/10/2026, 12:00:00');
      expect(message.html).toContain('02/10/2026, 12:00:00');
    });

    it('should point to the password recovery when the link expires', async () => {
      await service.sendAccountActivationLink('novo@test.com', link, expiresAt);

      const [message] = sendMail.mock.calls[0] as [{ text: string }];
      expect(message.text).toContain('Esqueci minha senha');
    });

    it('should propagate errors from sendMail', async () => {
      sendMail.mockRejectedValue(new Error('SMTP indisponível'));

      await expect(
        service.sendAccountActivationLink('novo@test.com', link, expiresAt),
      ).rejects.toThrow('SMTP indisponível');
    });
  });
});

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

    it('should propagate errors from sendMail', async () => {
      sendMail.mockRejectedValue(new Error('SMTP indisponível'));

      await expect(
        service.sendPasswordResetCode('user@test.com', '123456'),
      ).rejects.toThrow('SMTP indisponível');
    });
  });
});

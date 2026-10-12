import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { AuthGuard } from './auth.guard';
import { Public } from './constants/constants';
import { AllowPasswordChange } from './decorators/allow-password-change.decorator';
import { AllowIncompleteRegistration } from './decorators/allow-incomplete-registration.decorator';
import { ApiBody } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  sessionCookieName,
  sessionCookieOptions,
} from 'src/common/session-cookie';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiBody({
    type: AuthDto,
    description: 'Objeto para obter o token.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(
    @Body() auth: AuthDto,
    @Request() request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const { access_token } = await this.authService.signIn(
      auth.email,
      auth.password,
      {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );
    this.setSessionCookie(response, access_token);
    return { message: 'Sessão iniciada.' };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Get('google/config')
  getGoogleConfig() {
    return this.authService.getGoogleConfig();
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('google')
  async signInWithGoogle(
    @Body() dto: GoogleAuthDto,
    @Request() request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const { access_token } = await this.authService.signInWithGoogle(
      dto.credential,
      {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );
    this.setSessionCookie(response, access_token);
    return { message: 'Sessão iniciada.' };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiBody({
    type: ForgotPasswordDto,
    description: 'Objeto para solicitar o código de recuperação de senha.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<any> {
    return await this.authService.forgotPassword(dto.email);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiBody({
    type: VerifyResetCodeDto,
    description: 'Objeto para verificar o código de recuperação de senha.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto): Promise<any> {
    return await this.authService.verifyResetCode(dto.email, dto.code);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiBody({
    type: ResetPasswordDto,
    description: 'Objeto para redefinir a senha com o código de recuperação.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<any> {
    return await this.authService.resetPassword(
      dto.email,
      dto.code,
      dto.password,
    );
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiBody({
    type: ActivateAccountDto,
    description:
      'Objeto para definir a primeira senha com o link enviado por e-mail no cadastro.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('activate')
  async activateAccount(
    @Body() dto: ActivateAccountDto,
  ): Promise<{ message: string }> {
    return await this.authService.activateAccount(dto.token, dto.password);
  }

  @AllowPasswordChange()
  @AllowIncompleteRegistration()
  @UseGuards(AuthGuard)
  @Get('profile')
  @ApiBody({
    description:
      'Devolve o perfil do usuário da sessão, identificada pelo cookie de sessão ou pelo header "Authorization: Bearer {token}".',
  })
  getProfile(@Request() req) {
    return req.user;
  }

  @AllowPasswordChange()
  @AllowIncompleteRegistration()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Request() request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.logout(request.user.jti);
    // O front não consegue apagar um cookie HttpOnly, então quem o remove é o back.
    response.clearCookie(sessionCookieName(), sessionCookieOptions());
    return result;
  }

  // Sem @Levels: qualquer usuário autenticado pode alterar os próprios dados.
  // A identidade é lida do token (req.user.email), não do corpo. O rate limit
  // limita as tentativas de senha atual feitas com uma sessão aberta.
  @AllowPasswordChange()
  @UseGuards(AuthGuard, ThrottlerGuard)
  @ApiBody({
    type: UpdateProfileDto,
    description: 'Altera o e-mail e/ou a senha do próprio usuário autenticado.',
  })
  @Patch('me')
  async updateMe(
    @Request() req,
    @Body() dto: UpdateProfileDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const { access_token } = await this.authService.updateProfile(
      req.user.email,
      dto,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
    this.setSessionCookie(response, access_token);
    return { message: 'Dados atualizados.' };
  }

  // Única rota de escrita aberta para a conta criada pelo Google que ainda não
  // cadastrou CPF e senha. O rate limit reduz o uso da resposta de CPF já
  // cadastrado para descobrir CPFs de outras contas.
  @AllowIncompleteRegistration()
  @UseGuards(AuthGuard, ThrottlerGuard)
  @ApiBody({
    type: CompleteRegistrationDto,
    description:
      'Cadastra o CPF e a senha da conta criada pelo login com Google.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('complete-registration')
  async completeRegistration(
    @Request() req,
    @Body() dto: CompleteRegistrationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const { access_token } = await this.authService.completeRegistration(
      req.user.email,
      dto,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
    this.setSessionCookie(response, access_token);
    return { message: 'Cadastro concluído.' };
  }

  // O token vai só no cookie HttpOnly, fora do corpo, para nenhum JavaScript
  // da página conseguir lê-lo.
  private setSessionCookie(response: Response, accessToken: string) {
    response.cookie(sessionCookieName(), accessToken, sessionCookieOptions());
  }
}

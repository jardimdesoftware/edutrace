import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGuard } from './auth.guard';
import { Public } from './constants/constants';
import { AllowPasswordChange } from './decorators/allow-password-change.decorator';
import { ApiBody } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiBody({
    type: AuthDto,
    description: 'Objeto para obter o token.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(@Body() auth: AuthDto): Promise<any> {
    return await this.authService.signIn(auth.email, auth.password);
  }

  @Public()
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

  @AllowPasswordChange()
  @UseGuards(AuthGuard)
  @Get('profile')
  @ApiBody({
    description:
      'Para obter o perfil do usuário, basta passar o token no header da requisição ex: "Authorization: "Bearer {token}""',
  })
  getProfile(@Request() req) {
    return req.user;
  }

  // Sem @Levels: qualquer usuário autenticado pode alterar os próprios dados.
  // A identidade é lida do token (req.user.email), não do corpo.
  @AllowPasswordChange()
  @UseGuards(AuthGuard)
  @ApiBody({
    type: UpdateProfileDto,
    description: 'Altera o e-mail e/ou a senha do próprio usuário autenticado.',
  })
  @Patch('me')
  async updateMe(@Request() req, @Body() dto: UpdateProfileDto) {
    return await this.authService.updateProfile(req.user.email, dto);
  }
}

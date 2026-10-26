import {
  ForbiddenException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { maskUserCpf, maskUsersCpf } from 'src/common/mask-cpf';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { USER_CREATE_THROTTLE } from './users.throttle';
import { hasAnyRole } from 'src/auth/roles';
import { sameRoles } from './roles';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @AllowLevels(LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE)
  @ApiBody({
    type: CreateUserDto,
    description:
      'Objeto para criação de um novo usuário por um administrador ou pelo Profissional NAPNE, que cadastra apenas estudantes.',
  })
  @Throttle(USER_CREATE_THROTTLE)
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const requesterRoles = req.user?.roles;

    if (
      !hasAnyRole(requesterRoles, [LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE])
    ) {
      throw new ForbiddenException(
        'Apenas administradores e o Profissional NAPNE podem cadastrar usuários',
      );
    }

    const createdRoles = createUserDto.roles ?? [LEVELS.ALUNO_ESTUDANTE];

    if (
      !hasAnyRole(requesterRoles, [LEVELS.ADMIN]) &&
      !sameRoles(createdRoles, [LEVELS.ALUNO_ESTUDANTE])
    ) {
      throw new ForbiddenException(
        'O Profissional NAPNE cadastra apenas estudantes.',
      );
    }

    return maskUserCpf(
      await this.usersService.create({
        ...createUserDto,
        roles: createdRoles,
      }),
    );
  }

  @AllowLevels(LEVELS.ADMIN)
  @Get()
  async findAll() {
    return maskUsersCpf(await this.usersService.findAll());
  }

  @AllowLevels(LEVELS.ADMIN)
  @Get(':email')
  async findOne(@Param('email') email: string) {
    const user = await this.usersService.findOnePublic(email);
    return user ? maskUserCpf(user) : user;
  }

  @AllowLevels(LEVELS.ADMIN)
  @ApiBody({
    type: UpdateUserDto,
    description: 'Obejto para atualização de informações de um usuário.',
  })
  @Patch(':email')
  async update(
    @Param('email') email: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return maskUserCpf(await this.usersService.update(email, updateUserDto));
  }

  @AllowLevels(LEVELS.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return maskUserCpf(await this.usersService.remove(+id));
  }
}

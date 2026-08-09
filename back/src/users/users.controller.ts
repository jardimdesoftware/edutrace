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
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBody } from '@nestjs/swagger';
import { Levels } from 'src/auth/decorators/levels.decorator';
import { LEVELS } from 'src/constants';
import { maskUserCpf, maskUsersCpf } from 'src/common/mask-cpf';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Levels(
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @ApiBody({
    type: CreateUserDto,
    description:
      'Objeto para criação de um novo usuário por um administrador.',
  })
  @Post()
  async create(@Body() createUserDto: CreateUserDto, @Req() req: Request) {
    const user = (req as Request & { user?: { id_level?: number } }).user;

    if (user?.id_level !== LEVELS.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem cadastrar usuários');
    }

    return maskUserCpf(await this.usersService.create(createUserDto));
  }

  @Levels(LEVELS.ALUNO_ESTUDANTE)
  @Get()
  async findAll() {
    return maskUsersCpf(await this.usersService.findAll());
  }

  @Levels(LEVELS.ALUNO_ESTUDANTE)
  @Get(':email')
  async findOne(@Param('email') email: string) {
    const user = await this.usersService.findOne(email);
    return user ? maskUserCpf(user) : user;
  }

  @Levels(
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @ApiBody({
    type: UpdateUserDto,
    description: 'Obejto para atualização de informações de um usuário.',
  })
  @Patch(':email')
  update(@Param('email') email: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(email, updateUserDto);
  }

  @Levels(
    LEVELS.ALUNO_ESTUDANTE,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  ) 
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}

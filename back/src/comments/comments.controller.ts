import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Levels } from 'src/auth/decorators/levels.decorator';
import { LEVELS } from 'src/constants';
import { ApiBody } from '@nestjs/swagger';
import { AuthenticatedRequest } from './types/express';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Levels(LEVELS.ALUNO_ESTUDANTE)
  @ApiBody({
    type: CreateCommentDto,
    description: 'Objeto para criação de uma nova anotação.',
  })
  @Post()
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @Request() request: AuthenticatedRequest,
  ) {
    const idUser = request.user.sub;
    const userName = request.user.name;

    return this.commentsService.create(createCommentDto, idUser, userName);
  }

  @Levels(LEVELS.ALUNO_ESTUDANTE)
  @ApiBody({
    type: UpdateCommentDto,
    description: 'Objeto para edição de uma anotação existente.',
  })
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.commentsService.update(id, updateCommentDto, request);
  }

  @Get(':id_user')
  findAllByIdUser(
    @Param('id_user') id_user: string,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.commentsService.findAllByIdUser(+id_user, request);
  }
}

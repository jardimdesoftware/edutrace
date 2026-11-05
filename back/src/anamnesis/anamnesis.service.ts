import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAnamnesisDto } from './dto/create-anamnesis.dto';
import { PrismaService } from 'src/database/prisma.service';
import { ANAMNESIS_READERS, PHASES } from 'src/constants';
import { hasAnyRole } from 'src/auth/roles';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { StudentsService } from 'src/students/students.service';
import { FormType } from '@prisma/client';
import {
  FormRevisionsService,
  RevisionAuthor,
} from 'src/form-revisions/form-revisions.service';

@Injectable()
export class AnamnesisService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
    private formRevisions: FormRevisionsService,
  ) {}

  async create(createAnamnesisDto: CreateAnamnesisDto, author: RevisionAuthor) {
    const student = await this.studentsService.findOneOrFail({
      email: createAnamnesisDto.email,
    });

    // A anamnese, a versão 1 e a fase do estudante são gravadas juntas: se
    // uma falhar, nenhuma fica no banco.
    return this.prisma.$transaction(async (tx) => {
      const anamnesisCreated = await tx.anamnesis.create({
        data: createAnamnesisDto,
      });
      await this.formRevisions.recordCreation(
        tx,
        { formType: FormType.ANAMNESIS, idStudent: student.id },
        anamnesisCreated,
        author,
      );
      await tx.user.update({
        where: { email: createAnamnesisDto.email },
        data: { id_current_phase: PHASES.ANAMNESE },
      });
      return anamnesisCreated;
    });
  }

  async findAll() {
    const emails = await this.studentsService.findAllEmails();

    return this.prisma.anamnesis.findMany({
      where: { email: { in: emails } },
    });
  }

  async findOne(email: string, request: AuthenticatedRequest) {
    const readsAnyStudent = hasAnyRole(request.user.roles, ANAMNESIS_READERS);
    const isOwnRecord = request.user.email === email;

    if (!readsAnyStudent && !isOwnRecord) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar esta anamnese',
      );
    }

    await this.studentsService.findOneOrFail({ email });

    return this.prisma.anamnesis.findUnique({
      where: { email },
    });
  }

  async update(
    email: string,
    updateAnamnesisDto: Partial<CreateAnamnesisDto>,
    author: RevisionAuthor,
  ) {
    // O PATCH devolve o registro inteiro: o titular precisa ser estudante,
    // como na leitura. O DELETE fica sem a conferência para que registros
    // gravados para quem não é estudante continuem removíveis.
    const student = await this.studentsService.findOneOrFail({ email });

    const existing = await this.prisma.anamnesis.findUnique({
      where: { email },
    });
    if (!existing) {
      throw new NotFoundException(`Anamnese com email ${email} não encontrada`);
    }

    // A edição e a versão nova são gravadas juntas; a edição que passa do
    // teto de versões recebe 409 e a anamnese não muda.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.anamnesis.update({
        where: { email },
        data: updateAnamnesisDto,
      });
      await this.formRevisions.recordEdit(
        tx,
        { formType: FormType.ANAMNESIS, idStudent: student.id },
        {
          before: existing,
          beforeAt: existing.updated_at ?? existing.created_at,
          after: updated,
        },
        author,
      );
      return updated;
    });
  }

  async remove(email: string) {
    const existing = await this.prisma.anamnesis.findUnique({
      where: { email },
    });
    if (!existing) {
      throw new NotFoundException(`Anamnese com email ${email} não encontrada`);
    }

    // Sem a conferência de que a conta é de estudante, como no resto do DELETE.
    const owner = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.anamnesis.delete({ where: { email } });
      if (owner) {
        await this.formRevisions.removeAll(tx, {
          formType: FormType.ANAMNESIS,
          idStudent: owner.id,
        });
      }
    });
    return { message: `Anamnese com email ${email} foi removida com sucesso` };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS, PEDAGOGICAL_MANAGER_LEVELS } from 'src/constants';
import { userSelectFor } from 'src/users/users.select';
import { hasAnyRole } from 'src/auth/roles';
import {
  MANAGER_KINDS,
  SetPedagogicalManagerDto,
} from './dto/set-pedagogical-manager.dto';

const NO_EXTERNAL_MANAGER = {
  external_manager_name: null,
  external_manager_phone: null,
  external_manager_cpf: null,
};

const INVALID_SERVER_MESSAGE =
  'O responsável pedagógico precisa ser um Profissional da Educação, um Profissional NAPNE ou um Professor do AEE.';

const INCOMPLETE_BODY_MESSAGE =
  'O corpo não tem os campos que o kind informado exige.';

const SELF_MANAGER_MESSAGE =
  'O estudante não pode ser o próprio responsável pedagógico.';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  // Os papéis de quem pede decidem o select (userSelectFor): o telefone e o CPF
  // do responsável externo só saem do banco para quem os administra.
  findAll(requesterRoles: readonly number[]) {
    return this.prisma.user.findMany({
      where: {
        roles: { has: LEVELS.ALUNO_ESTUDANTE },
        deleted_at: null,
      },
      select: userSelectFor(requesterRoles),
    });
  }

  findOne(email: string, requesterRoles: readonly number[]) {
    return this.prisma.user.findFirst({
      where: {
        email,
        roles: { has: LEVELS.ALUNO_ESTUDANTE },
        deleted_at: null,
      },
      select: userSelectFor(requesterRoles),
    });
  }

  // Titular de triagem, anamnese, PEI, anotação e relatório. Os profissionais
  // trabalham com registros de estudantes, então administrador, profissional e
  // e-mail sem conta caem no mesmo 404.
  async findOneOrFail(where: { email: string } | { id: number }) {
    const student = await this.prisma.user.findFirst({
      where: {
        ...where,
        roles: { has: LEVELS.ALUNO_ESTUDANTE },
        deleted_at: null,
      },
      select: { id: true, email: true },
    });

    if (!student) {
      throw new NotFoundException('Estudante não encontrado');
    }

    return student;
  }

  // Servidores que podem ser escolhidos como responsável pedagógico. Só o id, o
  // nome e os papéis saem: a lista alimenta um seletor, e o resto do cadastro do
  // servidor não faz parte dela.
  findPedagogicalManagerOptions() {
    return this.prisma.user.findMany({
      where: {
        roles: { hasSome: [...PEDAGOGICAL_MANAGER_LEVELS] },
        deleted_at: null,
      },
      select: { id: true, full_name: true, roles: true },
      orderBy: { full_name: 'asc' },
    });
  }

  // Cada tipo grava os dois lados, o do servidor e o do externo, e zera o que
  // não é dele. O responsável nunca fica nos dois tipos, mesmo que o corpo traga
  // campos dos dois (o DTO já os recusa), e os CHECKs do banco nunca são o
  // primeiro a barrar a gravação.
  //
  // O nível do estudante é conferido na própria trava da linha, dentro da
  // transação, e a gravação é pelo id dessa linha. Conferir antes, fora da
  // transação, deixava a troca de papéis do administrador passar entre a
  // conferência e a gravação, e uma conta que deixou de ser estudante ficava com
  // o vínculo. A troca de nível trava a mesma linha com FOR UPDATE: ela espera
  // este vínculo gravar e depois limpa o responsável, ou este vínculo espera a
  // troca terminar e não encontra mais o estudante (404).
  //
  // A ordem das travas é a da troca de nível do servidor (UsersService.update),
  // que trava a linha do servidor e depois as dos estudantes dele: primeiro o
  // servidor, depois o estudante. Na ordem inversa as duas transações esperariam
  // uma pela outra (deadlock).
  async setPedagogicalManager(
    email: string,
    dto: SetPedagogicalManagerDto,
    requesterRoles: readonly number[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const data = await this.pedagogicalManagerData(tx, dto);
      const student = await this.lockStudent(tx, email);

      if (data.pedagogical_manager_id === student.id) {
        throw new BadRequestException(SELF_MANAGER_MESSAGE);
      }

      return tx.user.update({
        where: { id: student.id },
        data,
        select: userSelectFor(requesterRoles),
      });
    });
  }

  // Mesma trava de setPedagogicalManager: o nível do estudante é conferido sob
  // o FOR UPDATE e a gravação é pelo id da linha travada.
  async setCourse(
    email: string,
    course: string,
    requesterRoles: readonly number[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const student = await this.lockStudent(tx, email);

      return tx.user.update({
        where: { id: student.id },
        data: { course },
        select: userSelectFor(requesterRoles),
      });
    });
  }

  // Trava a linha do estudante (FOR UPDATE) e confere o nível sob a trava. Quem
  // grava um registro que depende do estudante dentro da mesma transação (o teto
  // de registros do PEI) se enfileira nela, e a troca de nível do administrador,
  // que trava a mesma linha, espera a gravação ou deixa o estudante de fora (404).
  async lockStudent(tx: Prisma.TransactionClient, email: string) {
    const [student] = await tx.$queryRaw<{ id: number }[]>`
      SELECT "id" FROM "User"
      WHERE "email" = ${email} AND ${LEVELS.ALUNO_ESTUDANTE} = ANY("roles")
        AND "deleted_at" IS NULL
      FOR UPDATE`;

    if (!student) {
      throw new NotFoundException('Estudante não encontrado');
    }

    return student;
  }

  private async pedagogicalManagerData(
    tx: Prisma.TransactionClient,
    dto: SetPedagogicalManagerDto,
  ): Promise<Prisma.UserUncheckedUpdateInput> {
    if (dto.kind === MANAGER_KINDS.SERVER) {
      if (dto.user_id === undefined) {
        throw new BadRequestException(INCOMPLETE_BODY_MESSAGE);
      }

      await this.assertServerManager(tx, dto.user_id);

      return { pedagogical_manager_id: dto.user_id, ...NO_EXTERNAL_MANAGER };
    }

    if (dto.kind === MANAGER_KINDS.EXTERNAL) {
      const { name, phone, cpf } = dto;

      if (name === undefined || phone === undefined || cpf === undefined) {
        throw new BadRequestException(INCOMPLETE_BODY_MESSAGE);
      }

      return {
        pedagogical_manager_id: null,
        external_manager_name: name,
        external_manager_phone: phone,
        external_manager_cpf: cpf,
      };
    }

    return { pedagogical_manager_id: null, ...NO_EXTERNAL_MANAGER };
  }

  // A linha do servidor é travada com FOR SHARE antes de ler o nível. A troca
  // de papéis dele trava a mesma linha com FOR UPDATE, então ela espera este
  // vínculo gravar (e depois o desfaz), e o vínculo espera a troca terminar (e
  // depois recusa o papel novo). Sem a trava, o estudante poderia ficar ligado a
  // quem deixou os papéis 3 e 5 entre a conferência e a gravação.
  private async assertServerManager(
    tx: Prisma.TransactionClient,
    userId: number,
  ) {
    const [server] = await tx.$queryRaw<{ roles: number[] }[]>`
      SELECT "roles" FROM "User" WHERE "id" = ${userId}
        AND "deleted_at" IS NULL FOR SHARE`;

    if (!server || !hasAnyRole(server.roles, PEDAGOGICAL_MANAGER_LEVELS)) {
      throw new BadRequestException(INVALID_SERVER_MESSAGE);
    }
  }

  async findAllEmails(): Promise<string[]> {
    const students = await this.prisma.user.findMany({
      where: { roles: { has: LEVELS.ALUNO_ESTUDANTE }, deleted_at: null },
      select: { email: true },
    });

    return students.map((student) => student.email);
  }
}

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { LEVELS } from '../src/constants';
import { readInitialAdmin } from '../src/users/initial-admin';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

async function main() {
  // O código lê os níveis pelos ids de LEVELS, então o id é gravado de forma
  // explícita. Com upsert por nome, o id saía do autoincrement e, num banco em
  // que a sequence não começa em 1, cada nível ficava com um id diferente do
  // que o código espera.
  const levels = [
    { id: LEVELS.ADMIN, name: 'Administrador' },
    { id: LEVELS.ALUNO_ESTUDANTE, name: 'Estudante/Família' },
    { id: LEVELS.PROFISSIONAL_EDUCACAO, name: 'Profissional da Educação' },
    { id: LEVELS.PROFISSIONAL_SAUDE, name: 'Profissional da Saúde' },
    { id: LEVELS.PROFISSIONAL_NAPNE, name: 'Profissional NAPNE' },
  ];

  for (const level of levels) {
    await prisma.level.upsert({
      where: { id: level.id },
      update: { name: level.name },
      create: level,
    });
  }

  const phases = [
    { name: 'Triagem' },
    { name: 'Anamnese' },
  ]

  for (const phase of phases) {
    await prisma.currentPhases.upsert({
      where: { name: phase.name },
      update: {},
      create: phase,
    });
  }

  // O administrador inicial é criado só quando o banco não tem nenhum
  // administrador. Procurar um e-mail fixo recriava a conta excluída e, depois
  // da troca do e-mail do administrador, tentava criar outro com o mesmo CPF:
  // o seed falhava e a API não subia. E-mail, CPF e senha vêm do ambiente, e a
  // instalação que já tem administrador sobe sem ADMIN_EMAIL e ADMIN_CPF.
  if (process.env.ADMIN_PASSWORD) {
    const adminLevel = await prisma.level.findUniqueOrThrow({
      where: { name: 'Administrador' },
    });
    const triagePhase = await prisma.currentPhases.findUniqueOrThrow({
      where: { name: 'Triagem' },
    });

    const admins = await prisma.user.count({
      where: { id_level: adminLevel.id },
    });

    if (admins === 0) {
      const admin = readInitialAdmin(process.env);

      await prisma.user.create({
        data: {
          full_name: 'Administrador Padrão',
          cpf: admin.cpf,
          email: admin.email,
          password: await hash(admin.password, 10),
          id_level: adminLevel.id,
          id_current_phase: triagePhase.id,
          must_change_password: true,
        },
      });
    }
  }

  console.log('Seed concluída');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

async function main() {
  const levels = [
    { name: 'Administrador' },
    { name: 'Estudante/Família' },
    { name: 'Profissional da Educação' },
    { name: 'Profissional da Saúde' }
  ];

  for (const level of levels) {
    await prisma.level.upsert({
      where: { name: level.name },
      update: {},
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

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@edutrace.com' },
    });

    if (!admin) {
      const adminLevel = await prisma.level.findUnique({
        where: { name: 'Administrador' },
      });

      const triagePhase = await prisma.currentPhases.findUnique({
        where: { name: 'Triagem' },
      });

      if (adminLevel && triagePhase) {
        const encryptedPassword = await hash(adminPassword, 10);
        await prisma.user.create({
          data: {
            full_name: 'Administrador Padrão',
            cpf: '01234567890',
            email: 'admin@edutrace.com',
            password: encryptedPassword,
            id_level: adminLevel.id,
            id_current_phase: triagePhase.id,
            must_change_password: true,
          },
        });
      }
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

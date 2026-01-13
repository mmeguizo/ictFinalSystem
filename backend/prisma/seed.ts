import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const seedUsers = [
    {
      email: 'alice@chmsu.edu.ph',
      name: 'Alice',
      picture: 'https://picsum.photos/seed/alice/200',
    },
    {
      email: 'bob@chmsu.edu.ph',
      name: 'Bob',
      picture: 'https://picsum.photos/seed/bob/200',
    },
  ];

  for (const user of seedUsers) {
    try {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          picture: user.picture,
          avatarUrl: user.picture,
        },
        create: {
          email: user.email,
          name: user.name,
          picture: user.picture,
          avatarUrl: user.picture,
        },
      });
    } catch (err: any) {
      // If the avatarUrl column doesn't exist (Prisma P2022), retry without avatarUrl
      if (err?.code === 'P2022' && err?.meta?.column === 'avatarUrl') {
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name, picture: user.picture },
          create: { email: user.email, name: user.name, picture: user.picture },
        });
      } else {
        throw err;
      }
    }
  }

  // Attempt to backfill avatarUrl where missing. If the column isn't present, skip this step.
  let backfilled = 0;
  try {
    const needsAvatar = await prisma.user.findMany({
      where: {
        avatarUrl: null,
        NOT: { picture: null },
      },
      select: { id: true, picture: true },
    });

    for (const user of needsAvatar) {
      await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: user.picture } });
    }
    backfilled = needsAvatar.length;
    // console.log(`Backfilled ${backfilled} avatar(s)`);
  } catch (err: any) {
    if (err?.code === 'P2022' && err?.meta?.column === 'avatarUrl') {
      // console.log('avatarUrl column missing, skipping backfill step');
    } else {
      throw err;
    }
  }

  // console.log(`Seeded users (${seedUsers.length}) and backfilled ${backfilled} avatar(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    // Re-throw so the process exits with a failure code after disconnecting
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

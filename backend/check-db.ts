import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tickets = await prisma.ticket.findMany({
    select: { id: true, ticketNumber: true, createdById: true, status: true }
  });
  // console.log('Tickets:', JSON.stringify(tickets, null, 2));
  
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true }
  });
  // console.log('Users:', JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

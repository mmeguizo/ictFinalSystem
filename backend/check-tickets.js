const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const tickets = await prisma.ticket.findMany({
      select: {
        id: true,
        ticketNumber: true,
        type: true,
        status: true,
        title: true
      }
    });
    
    console.log('All tickets:');
    console.log(JSON.stringify(tickets, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();

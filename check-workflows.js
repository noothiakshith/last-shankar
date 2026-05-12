const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const workflows = await prisma.workflowRun.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      events: { take: 3, orderBy: { occurredAt: 'desc' } },
      approvals: true
    }
  });
  
  console.log(`Found ${workflows.length} workflows:`);
  workflows.forEach(w => {
    console.log(`- ${w.id}: ${w.type} (${w.state}) - ${w.events.length} events, ${w.approvals.length} approvals`);
  });
  
  if (workflows.length > 0) {
    console.log('\nFirst workflow detail:');
    console.log(JSON.stringify(workflows[0], null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

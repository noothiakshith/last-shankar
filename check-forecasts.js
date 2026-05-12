const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const forecasts = await prisma.forecastResult.findMany({
    take: 10,
    orderBy: { generatedAt: 'desc' },
    select: {
      id: true,
      productId: true,
      status: true,
      generatedAt: true,
      approvedBy: true
    }
  });
  
  console.log(`Found ${forecasts.length} forecasts:\n`);
  forecasts.forEach(f => {
    const shortId = f.id.length > 20 ? f.id.substring(0, 20) + '...' : f.id;
    console.log(`${shortId} | ${f.productId} | ${f.status} | ${f.generatedAt.toISOString().substring(0, 19)} | ${f.approvedBy || 'N/A'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

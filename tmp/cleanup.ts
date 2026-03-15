import prisma from '../src/lib/prisma';
async function clean() {
  await prisma.trainedModel.deleteMany({where: {artifactPath: '/tmp/test_stub'}});
  console.log('Cleaned mock models');
}
clean().then(()=>process.exit(0)).catch(e=>{console.error(e); process.exit(1)});

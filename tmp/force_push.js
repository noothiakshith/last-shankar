import { execSync } from 'child_process';
try { execSync('npx env-cmd -f .env npx prisma db push --accept-data-loss', { stdio: 'inherit' }); } catch(e){}

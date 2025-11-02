/*
  Orchestrated Prisma seeding for Bakung Dashboard.
  - Seeds core roles
  - Seeds an owner user (uses SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD if provided)

  Run: npx prisma db seed
*/

const { spawnSync } = require('child_process');

function runNodeScript(scriptPath, args = []) {
  const res = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(`Seed step failed: node ${scriptPath} ${args.join(' ')}`);
  }
}

async function main() {
  console.log('[prisma/seed] Seeding roles...');
  runNodeScript('scripts/seed-roles.js');

  console.log('[prisma/seed] Seeding owner user...');
  // seed-owner-user.js reads SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD from env
  runNodeScript('scripts/seed-owner-user.js');

  console.log('[prisma/seed] All seed steps completed.');
}

main().catch((err) => {
  console.error('[prisma/seed] Error:', err);
  process.exitCode = 1;
});


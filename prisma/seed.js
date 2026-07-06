/*
  Orchestrated Prisma seeding for Bakung Dashboard.
  - Seeds core roles
  - Seeds an owner user (uses SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD if provided)

  Run: npx prisma db seed
*/

const { spawn } = require('child_process');
const path = require('path');

async function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`[prisma/seed] Running: ${scriptPath} ${args.join(' ')}`);
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Seed step failed: ${scriptPath} `));
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  try {
    console.log('[prisma/seed] Starting database seeding...');
    
    console.log('[prisma/seed] Creating basic brand profile...');
    await runNodeScript('scripts/create-basic-brand.js');
    
    console.log('[prisma/seed] Seeding owner user...');
    await runNodeScript('scripts/seed-owner-user.js');
    
    // Get owner email from environment or use default
    const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@example.com';
    
    console.log('[prisma/seed] Seeding roles...');
    await runNodeScript('scripts/seed-roles.js', ['--email', ownerEmail]);

    console.log('[prisma/seed] Generating dummy products...');
    await runNodeScript('scripts/generate-products.js');

    console.log('[prisma/seed] Generating dummy customers...');
    await runNodeScript('scripts/generate-customers.js');
    
    console.log('[prisma/seed] Database seeding completed successfully!');
  } catch (error) {
    console.error('[prisma/seed] Error:', error);
    process.exit(1);
  }
}

main();


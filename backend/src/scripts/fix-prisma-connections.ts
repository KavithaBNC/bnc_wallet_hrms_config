import * as fs from 'fs';
import * as path from 'path';

// List of service files to update
const serviceFiles = [
  'src/services/auth.service.ts',
  'src/services/employee.service.ts',
  'src/services/organization.service.ts',
  'src/services/department.service.ts',
  'src/services/job-position.service.ts',
  'src/services/attendance.service.ts',
  'src/services/leave-request.service.ts',
  'src/services/leave-type.service.ts',
  'src/services/leave-balance.service.ts',
  'src/services/leave-policy.service.ts',
  'src/services/shift.service.ts',
  'src/services/holiday.service.ts',
  'src/services/attendance-regularization.service.ts',
  'src/services/permission.service.ts',
  'src/services/role-permission.service.ts',
  'src/services/job-opening.service.ts',
  'src/services/candidate.service.ts',
  'src/services/application.service.ts',
  'src/services/interview.service.ts',
  'src/services/offer.service.ts',
];

console.log('🔄 Updating PrismaClient imports to use shared instance...\n');

let updatedCount = 0;

for (const file of serviceFiles) {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipping ${file} (not found)`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // Check if already using shared prisma
  if (content.includes("from '../utils/prisma'") || content.includes("from './utils/prisma'")) {
    console.log(`✅ ${file} already uses shared prisma`);
    continue;
  }

  // Replace PrismaClient import and instantiation
  const oldImportPattern = /import\s+{\s*PrismaClient[^}]*}\s+from\s+['"]@prisma\/client['"];?/g;
  const newImport = content.match(/import\s+{\s*PrismaClient[^}]*}\s+from\s+['"]@prisma\/client['"];?/)?.[0] || '';
  
  if (newImport) {
    // Extract other imports from PrismaClient line
    const imports = newImport.match(/\{([^}]+)\}/)?.[1] || '';
    const otherImports = imports.split(',').map(i => i.trim()).filter(i => i !== 'PrismaClient' && i !== 'Prisma');
    
    // Remove PrismaClient import line
    content = content.replace(oldImportPattern, '');
    
    // Add import for shared prisma
    const importLine = otherImports.length > 0
      ? `import { ${otherImports.join(', ')} } from '@prisma/client';\nimport { prisma } from '../utils/prisma';`
      : `import { prisma } from '../utils/prisma';`;
    
    // Find the first import line and add after it
    const firstImportMatch = content.match(/^import\s+.*$/m);
    if (firstImportMatch) {
      const insertIndex = content.indexOf(firstImportMatch[0]) + firstImportMatch[0].length;
      content = content.slice(0, insertIndex) + '\n' + importLine + content.slice(insertIndex);
    } else {
      content = importLine + '\n' + content;
    }
  }

  // Remove PrismaClient instantiation
  content = content.replace(/const\s+prisma\s*=\s*new\s+PrismaClient\(\);?\s*\n?/g, '');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Updated ${file}`);
  updatedCount++;
}

console.log(`\n✨ Updated ${updatedCount} files to use shared PrismaClient instance!`);
console.log('\n⚠️  Note: Please review the changes and test your application.');

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * دالة مساعدة لقراءة جميع ملفات TypeScript داخل مجلد معين بشكل تكراري
 */
function getAllTsFiles(dirPath: string): string[] {
  let files: string[] = [];
  const items = readdirSync(dirPath);

  for (const item of items) {
    const fullPath = join(dirPath, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(getAllTsFiles(fullPath));
    } else if (fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Clean Architecture & Module Boundaries Verification', () => {
  it('should enforce that TasksModule does not directly import LabelsRepository', () => {
    const tasksModuleDir = join(__dirname, 'tasks');
    const tasksFiles = getAllTsFiles(tasksModuleDir);

    const forbiddenImportPattern = /LabelsRepository/;

    const violations: string[] = [];

    for (const filePath of tasksFiles) {
      const content = readFileSync(filePath, 'utf-8');
      if (forbiddenImportPattern.test(content)) {
        violations.push(filePath);
      }
    }

    // التأكد من عدم وجود أي ملف داخل TasksModule يستورد LabelsRepository مباشرة
    expect(
      violations,
      `Architecture Violation: TasksModule files must not reference LabelsRepository directly. Use LabelsService instead. Violating files: ${violations.join(', ')}`,
    ).toEqual([]);
  });
});
// ========== 极简测试运行器 ==========
let passed = 0;
let failed = 0;
const failures: string[] = [];
const _tests: { name: string; fn: () => void }[] = [];
let _currentGroup = '';

export function test(name: string, fn: () => void): void {
  _tests.push({ name, fn });
}

export function group(name: string): void {
  _currentGroup = name;
  console.log(`\n--- ${name} ---`);
}

export async function runAll(): Promise<void> {
  for (const t of _tests) {
    try {
      await t.fn();
      passed++;
    } catch (e: any) {
      failed++;
      failures.push(`FAIL ${t.name}: ${e.message}`);
    }
  }
  console.log();
  for (const f of failures) console.error(f);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// ========== 测试数据 ==========

export interface TestFileNode {
  name: string; path: string; isDir: boolean;
  isLink?: boolean; children?: TestFileNode[];
}

export const singleFolder: TestFileNode[] = [
  { name: 'src', path: './src', isDir: true, children: [
    { name: 'index.ts', path: './src/index.ts', isDir: false },
  ]},
];

export const nestedFolders: TestFileNode[] = [
  { name: 'src', path: './src', isDir: true, children: [
    { name: 'lib', path: './src/lib', isDir: true, children: [
      { name: 'util.ts', path: './src/lib/util.ts', isDir: false },
    ]},
  ]},
  { name: 'README.md', path: './README.md', isDir: false },
];

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const projectRoot = path.resolve(__dirname, '../..');
const skillsGuidePath = path.join(projectRoot, 'skills guide');

// 가짜 npm 바이너리는 OS temp 에 만든다. 소스 트리(__dirname)에 두면 실행이 중단됐을 때
// untracked 실행파일이 남아 livemetro-workflow.md 의 "e2e 테스트 잔여물 방지" 규칙을 어긴다.
const fakeBinPath = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-guide-updater-bin-'));

function getManagedFilePaths() {
  return [
    ...fs
      .readdirSync(skillsGuidePath)
      .filter((fileName) => fileName.endsWith('.md'))
      .map((fileName) => path.join(skillsGuidePath, fileName)),
    path.join(skillsGuidePath, '.last-update.json'),
  ];
}

function snapshotFiles(filePaths) {
  return new Map(
    filePaths.map((filePath) => [filePath, fs.readFileSync(filePath)])
  );
}

function restoreFiles(snapshot) {
  snapshot.forEach((content, filePath) => {
    fs.writeFileSync(filePath, content);
  });
}

afterEach(() => {
  fs.rmSync(fakeBinPath, { recursive: true, force: true });
});

test('--check-only validates without modifying managed files', () => {
  const managedFilePaths = getManagedFilePaths();
  const before = snapshotFiles(managedFilePaths);

  fs.mkdirSync(fakeBinPath, { recursive: true });
  const fakeNpmPath = path.join(fakeBinPath, 'npm');
  fs.writeFileSync(
    fakeNpmPath,
    `#!/usr/bin/env node\nconst query = process.argv.slice(2).join(' ');\nconsole.log(query.includes('time.modified') ? new Date().toISOString() : '999.0.0');\n`
  );
  fs.chmodSync(fakeNpmPath, 0o755);

  let result;
  try {
    result = spawnSync(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        path.join(projectRoot, 'scripts/skillsGuideUpdater.ts'),
        '--check-only',
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeBinPath}${path.delimiter}${process.env.PATH || ''}`,
        },
        timeout: 30_000,
      }
    );

    assert.equal(
      result.status,
      0,
      `skills:check failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );

    managedFilePaths.forEach((filePath) => {
      assert.deepEqual(
        fs.readFileSync(filePath),
        before.get(filePath),
        `${path.relative(projectRoot, filePath)} was modified by --check-only`
      );
    });
  } finally {
    restoreFiles(before);
  }
});

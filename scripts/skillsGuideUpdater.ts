/**
 * Skills Guide Auto-Updater
 *
 * 이 스크립트는 30일마다 skills guide의 내용을 최신 기술로 업데이트하고
 * 낙후된 기술을 자동으로 제거합니다.
 *
 * 주요 기능:
 * - 기술 스택 버전 추적 및 비교
 * - 낙후된 기술 감지 (6개월 이상 업데이트 없음)
 * - 자동 문서 업데이트
 * - 변경 사항 보고서 생성
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ================== 설정 ==================

interface TechStackItem {
  name: string;
  currentVersion: string;
  category: 'core' | 'dependency' | 'devDependency' | 'tool';
  isDeprecated?: boolean;
  lastChecked?: string;
  latestVersion?: string;
  deprecated?: boolean;
  alternatives?: string[];
}

interface UpdateConfig {
  skillsGuidePath: string;
  packageJsonPath: string;
  updateIntervalDays: number;
  deprecationThresholdMonths: number;
  lastUpdateFile: string;
  reportPath: string;
}

const CONFIG: UpdateConfig = {
  skillsGuidePath: path.join(__dirname, '../skills guide'),
  packageJsonPath: path.join(__dirname, '../package.json'),
  updateIntervalDays: 30,
  deprecationThresholdMonths: 6,
  lastUpdateFile: path.join(__dirname, '../skills guide/.last-update.json'),
  reportPath: path.join(__dirname, '../skills guide/LIVEMETRO_UPDATE_REPORT.md'),
};

// ================== 유틸리티 함수 ==================

/**
 * 마지막 업데이트 날짜 확인
 */
function getLastUpdateDate(): Date | null {
  if (!fs.existsSync(CONFIG.lastUpdateFile)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(CONFIG.lastUpdateFile, 'utf-8'));
    return new Date(data.lastUpdate);
  } catch {
    return null;
  }
}

/**
 * 업데이트가 필요한지 확인
 */
function shouldUpdate(): boolean {
  const lastUpdate = getLastUpdateDate();

  if (!lastUpdate) {
    console.log('📋 첫 업데이트입니다.');
    return true;
  }

  const daysSinceUpdate = Math.floor(
    (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
  );

  console.log(`📅 마지막 업데이트: ${daysSinceUpdate}일 전`);

  return daysSinceUpdate >= CONFIG.updateIntervalDays;
}

/**
 * package.json에서 현재 기술 스택 추출
 */
function extractCurrentTechStack(): TechStackItem[] {
  const packageJson = JSON.parse(
    fs.readFileSync(CONFIG.packageJsonPath, 'utf-8')
  );

  const techStack: TechStackItem[] = [];

  // Core technologies
  const coreVersions: Record<string, string> = {
    'React Native': packageJson.dependencies['react-native'],
    'React': packageJson.dependencies['react'],
    'TypeScript': packageJson.devDependencies['typescript'],
    'Expo': packageJson.dependencies['expo'],
  };

  Object.entries(coreVersions).forEach(([name, version]) => {
    if (version) {
      techStack.push({
        name,
        currentVersion: version,
        category: 'core',
      });
    }
  });

  // Dependencies
  Object.entries(packageJson.dependencies as Record<string, string>).forEach(
    ([name, version]) => {
      if (!coreVersions[name] && version) {
        techStack.push({
          name,
          currentVersion: version,
          category: 'dependency',
        });
      }
    }
  );

  // DevDependencies
  Object.entries(packageJson.devDependencies as Record<string, string>).forEach(
    ([name, version]) => {
      if (name !== 'typescript' && version) {
        techStack.push({
          name,
          currentVersion: version,
          category: 'devDependency',
        });
      }
    }
  );

  return techStack;
}

/**
 * npm으로 최신 버전 확인
 */
async function getLatestVersion(packageName: string): Promise<string | null> {
  try {
    const result = execSync(`npm view ${packageName} version`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * 낙후된 기술인지 확인 (npm registry의 마지막 업데이트 날짜 기준)
 */
async function isDeprecated(packageName: string): Promise<boolean> {
  try {
    const result = execSync(`npm view ${packageName} time.modified`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const lastModified = new Date(result.trim());
    const monthsSinceUpdate = Math.floor(
      (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    return monthsSinceUpdate >= CONFIG.deprecationThresholdMonths;
  } catch {
    return false;
  }
}

/**
 * 기술 스택 검증 및 업데이트 정보 수집
 */
async function validateTechStack(
  techStack: TechStackItem[]
): Promise<TechStackItem[]> {
  console.log('🔍 기술 스택 검증 중...\n');

  const updatedStack: TechStackItem[] = [];

  for (const tech of techStack) {
    console.log(`  검사 중: ${tech.name}`);

    const latestVersion = await getLatestVersion(tech.name);
    const deprecated = await isDeprecated(tech.name);

    updatedStack.push({
      ...tech,
      latestVersion: latestVersion || tech.currentVersion,
      deprecated,
      lastChecked: new Date().toISOString(),
    });

    if (deprecated) {
      console.log(`    ⚠️  낙후된 패키지: ${tech.name}`);
    } else if (latestVersion && latestVersion !== tech.currentVersion.replace(/[~^]/, '')) {
      console.log(`    🆕 새 버전 사용 가능: ${latestVersion}`);
    } else {
      console.log(`    ✅ 최신 상태`);
    }
  }

  console.log('\n');
  return updatedStack;
}

/**
 * 마크다운 파일의 버전 정보 업데이트
 */
function updateMarkdownVersions(
  filePath: string,
  techStack: TechStackItem[]
): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let updated = false;

  // 날짜 업데이트
  const datePattern = /작성일:.*?(\d{4}-\d{2}-\d{2})/g;
  const today = new Date().toISOString().split('T')[0];

  if (datePattern.test(content)) {
    content = content.replace(
      datePattern,
      `작성일: ${today} (최신 업데이트)`
    );
    updated = true;
  }

  // 버전 번호 업데이트
  techStack.forEach((tech) => {
    if (!tech.latestVersion) return;

    // "React Native 0.72" 형태의 패턴
    const versionPattern = new RegExp(
      `${tech.name}\\s+[~^]?([\\d.]+)`,
      'gi'
    );

    if (versionPattern.test(content)) {
      content = content.replace(
        versionPattern,
        `${tech.name} ${tech.latestVersion}`
      );
      updated = true;
    }
  });

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return updated;
}

/**
 * 낙후된 기술 제거 (문서에서)
 */
function removeDeprecatedTech(
  filePath: string,
  deprecatedTech: TechStackItem[]
): boolean {
  if (!fs.existsSync(filePath) || deprecatedTech.length === 0) {
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let updated = false;

  deprecatedTech.forEach((tech) => {
    // 해당 기술을 언급하는 섹션 찾기 및 경고 추가
    const techPattern = new RegExp(
      `(#+\\s+.*${tech.name}.*\\n[\\s\\S]*?)(?=\\n#+|$)`,
      'gi'
    );

    if (techPattern.test(content)) {
      content = content.replace(
        techPattern,
        `$1\n> ⚠️ **주의**: ${tech.name}은(는) 더 이상 활발히 유지보수되지 않는 패키지입니다. 대안을 고려하세요.\n`
      );
      updated = true;
    }
  });

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return updated;
}

/**
 * 업데이트 보고서 생성
 */
function generateUpdateReport(
  techStack: TechStackItem[],
  updatedFiles: string[]
): void {
  const now = new Date();
  const report = `# LiveMetro Skills Guide 자동 업데이트 보고서

**업데이트 일시**: ${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}

## 📊 기술 스택 현황

### 핵심 기술 (Core)

${techStack
  .filter((t) => t.category === 'core')
  .map((t) => {
    const status = t.deprecated
      ? '⚠️ 낙후됨'
      : t.currentVersion === t.latestVersion
      ? '✅ 최신'
      : '🆕 업데이트 가능';

    return `- **${t.name}**: ${t.currentVersion} → ${t.latestVersion || t.currentVersion} ${status}`;
  })
  .join('\n')}

### 주요 의존성 (Top 10)

${techStack
  .filter((t) => t.category === 'dependency')
  .slice(0, 10)
  .map((t) => {
    const status = t.deprecated
      ? '⚠️ 낙후됨'
      : t.currentVersion === t.latestVersion
      ? '✅'
      : '🆕';

    return `- ${t.name}: ${t.currentVersion} ${status}`;
  })
  .join('\n')}

## 🔄 업데이트된 파일

${updatedFiles.length > 0 ? updatedFiles.map((f) => `- ${path.basename(f)}`).join('\n') : '_없음_'}

## ⚠️ 낙후된 기술

${(() => {
  const deprecated = techStack.filter((t) => t.deprecated);

  if (deprecated.length === 0) {
    return '_없음 - 모든 패키지가 활발히 유지보수되고 있습니다._';
  }

  return deprecated
    .map(
      (t) =>
        `- **${t.name}** (마지막 업데이트: ${CONFIG.deprecationThresholdMonths}개월 이상 전)\n  - 현재 버전: ${t.currentVersion}\n  - 권장 사항: 대체 패키지 검토 필요`
    )
    .join('\n\n');
})()}

## 📝 권장 사항

${(() => {
  const needsUpdate = techStack.filter(
    (t) =>
      !t.deprecated &&
      t.latestVersion &&
      t.currentVersion !== t.latestVersion
  );

  if (needsUpdate.length === 0) {
    return '모든 패키지가 최신 버전이거나 호환성을 위해 고정된 버전입니다. 👍';
  }

  return `다음 패키지들의 업데이트를 고려하세요:\n\n${needsUpdate
    .slice(0, 5)
    .map((t) => `- ${t.name}: ${t.currentVersion} → ${t.latestVersion}`)
    .join('\n')}`;
})()}

## 🔧 다음 업데이트

다음 자동 업데이트는 **${new Date(now.getTime() + CONFIG.updateIntervalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}**에 실행됩니다.

---
*이 보고서는 \`scripts/skillsGuideUpdater.ts\`에 의해 자동 생성되었습니다.*
`;

  fs.writeFileSync(CONFIG.reportPath, report, 'utf-8');
  console.log(`\n📄 보고서 생성 완료: ${CONFIG.reportPath}`);
}

/**
 * 마지막 업데이트 날짜 저장
 */
function saveUpdateDate(): void {
  const data = {
    lastUpdate: new Date().toISOString(),
    version: '1.0.0',
  };

  fs.writeFileSync(
    CONFIG.lastUpdateFile,
    JSON.stringify(data, null, 2),
    'utf-8'
  );
}

// ================== 메인 실행 ==================

async function main() {
  console.log('🚀 LiveMetro Skills Guide Auto-Updater\n');
  console.log('='.repeat(50));
  console.log('\n');

  // 1. 업데이트 필요 여부 확인
  if (!shouldUpdate() && process.argv[2] !== '--force') {
    console.log('✅ 아직 업데이트 시기가 아닙니다.');
    console.log('강제 실행하려면 --force 옵션을 사용하세요.\n');
    process.exit(0);
  }

  // 2. 현재 기술 스택 추출
  console.log('📦 현재 기술 스택 추출 중...\n');
  const techStack = extractCurrentTechStack();
  console.log(`  총 ${techStack.length}개의 패키지 발견\n`);

  // 3. 기술 스택 검증
  const validatedStack = await validateTechStack(techStack);

  // 4. 마크다운 파일 업데이트
  console.log('📝 문서 업데이트 중...\n');
  const updatedFiles: string[] = [];

  const markdownFiles = fs
    .readdirSync(CONFIG.skillsGuidePath)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(CONFIG.skillsGuidePath, f));

  markdownFiles.forEach((file) => {
    const basename = path.basename(file);

    // 버전 정보 업데이트
    const versionUpdated = updateMarkdownVersions(file, validatedStack);

    // 낙후된 기술 경고 추가
    const deprecated = validatedStack.filter((t) => t.deprecated);
    const deprecatedUpdated = removeDeprecatedTech(file, deprecated);

    if (versionUpdated || deprecatedUpdated) {
      updatedFiles.push(file);
      console.log(`  ✅ ${basename} 업데이트됨`);
    } else {
      console.log(`  ⏭️  ${basename} (변경 없음)`);
    }
  });

  console.log('\n');

  // 5. 보고서 생성
  console.log('📊 보고서 생성 중...\n');
  generateUpdateReport(validatedStack, updatedFiles);

  // 6. 업데이트 날짜 저장
  saveUpdateDate();

  console.log('\n='.repeat(50));
  console.log('✨ 업데이트 완료!\n');
  console.log(`📈 요약:`);
  console.log(`  - 검사한 패키지: ${validatedStack.length}개`);
  console.log(`  - 업데이트된 파일: ${updatedFiles.length}개`);
  console.log(`  - 낙후된 패키지: ${validatedStack.filter((t) => t.deprecated).length}개`);
  console.log(`  - 업데이트 가능: ${validatedStack.filter((t) => !t.deprecated && t.latestVersion && t.currentVersion !== t.latestVersion).length}개`);
  console.log('\n');
}

// 실행
main().catch((error) => {
  console.error('❌ 에러 발생:', error);
  process.exit(1);
});

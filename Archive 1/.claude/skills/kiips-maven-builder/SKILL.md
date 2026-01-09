---
name: kiips-maven-builder
description: Automates KiiPS Maven Multi-Module builds. Use when building KiiPS services, handling dependencies, or troubleshooting build issues.
---

# KiiPS Maven Builder Skill

## Purpose
Automate and manage Maven builds for KiiPS microservices architecture.

## Critical Build Rules
1. **Always build from KiiPS-HUB** - Never build from service directories
2. **Use `-am` flag** - Automatically build dependencies
3. **Build order**: COMMON → UTILS → Services

## Build Commands

### Full Project Build
```bash
cd KiiPS-HUB/
mvn clean package
```

### Specific Service Build
```bash
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-FD -am  # Builds FD + dependencies
mvn clean package -pl :KiiPS-IL -am  # Builds IL + dependencies
mvn clean package -pl :KiiPS-PG -am  # Builds PG + dependencies
```

### Quick Rebuild (Skip Tests)
```bash
mvn clean package -DskipTests=true
```

## Troubleshooting

### Build Failure Checklist
1. [ ] Are you in KiiPS-HUB directory?
2. [ ] Did you use `-am` flag?
3. [ ] Are COMMON/UTILS up to date?
4. [ ] Is Java 8 active? (`java -version`)
5. [ ] Is Maven configured correctly? (`mvn -v`)

### Common Issues
- **Missing dependencies**: Build COMMON/UTILS first
  ```bash
  cd KiiPS-HUB/
  mvn clean install -pl :KiiPS-COMMON -am
  mvn clean install -pl :KiiPS-UTILS -am
  ```
- **Version conflicts**: Check KiiPS-HUB/pom.xml
- **Out of memory**: Increase Maven heap size
  ```bash
  export MAVEN_OPTS="-Xmx2048m -XX:MaxPermSize=512m"
  ```

## Workflow Integration
```bash
# Complete build & deploy workflow
cd KiiPS-ServiceName/ && svn up  # Update from SVN
cd ../KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am
cd ../KiiPS-ServiceName/
./start.sh
```

## Verification
After build, verify artifacts:
```bash
# Check JAR/WAR files
ls -lh ../KiiPS-ServiceName/target/*.{jar,war}

# Verify dependencies
mvn dependency:tree -pl :KiiPS-ServiceName
```

## When to Use This Skill
- Building any KiiPS service
- After modifying pom.xml
- When dependency errors occur
- Before deploying services
- When switching branches

## Important Notes
- **Never** build directly in service directories
- **Always** use KiiPS-HUB as the starting point
- Tests are skipped by default (`<skipTests>true</skipTests>`)
- SVN update is integrated into build scripts

## Related Skills
- **kiips-service-deployer** - Deploy built services and verify deployment
- **kiips-feature-planner** - Plan features before building implementations
- **checklist-generator** - Generate build verification checklists
- **kiips-log-analyzer** - Analyze build logs for errors and warnings

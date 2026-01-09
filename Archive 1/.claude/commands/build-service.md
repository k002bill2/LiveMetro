---
description: Build a specific KiiPS service module
argument-hint: <service-name>
---

# Build KiiPS Service

Build the specified KiiPS service module from the parent POM.

**Usage:** `/build-service <service-name>`

**Examples:**
- `/build-service KiiPS-UI` - Build UI module
- `/build-service KiiPS-FD` - Build Fund module
- `/build-service KiiPS-IL` - Build Investment module

**Instructions for Claude:**

1. Navigate to KiiPS-HUB directory (parent POM location)
2. Run: `mvn clean package -pl :<service-name> -am`
3. The `-am` flag ensures all dependencies (COMMON, UTILS) are built first
4. Report build status and any errors
5. If successful, show the location of the generated JAR/WAR file

**Important Notes:**
- Always build from KiiPS-HUB directory, not from the service directory
- The `-am` flag (also make) is critical for dependency resolution
- Build output will be in the service's `target/` directory

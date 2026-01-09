---
description: Deploy a KiiPS service using its build script
argument-hint: <service-name>
---

# Deploy KiiPS Service

Run the deployment script for a specific KiiPS service.

**Usage:** `/deploy-service <service-name>`

**Instructions for Claude:**

1. Navigate to the service directory
2. Check for the service's build script:
   - Pattern: `build_<ServiceName>.sh`
   - Example: `build_UI.sh`, `build_FD.sh`
3. Review the script to understand the deployment steps:
   - SVN update
   - Maven build from KiiPS-HUB
   - File copy to deployment directory
   - Service restart
4. Ask user for confirmation before executing
5. Execute the build script
6. Monitor the output for:
   - SVN update status
   - Maven build success/failure
   - Service restart status
7. Check service logs after deployment to ensure successful startup
8. Report deployment status with any errors or warnings

**Important Notes:**
- Build scripts include `svn up` commands
- Scripts build from KiiPS-HUB with proper dependencies
- Services are automatically restarted after deployment
- Deployment paths vary by environment (check script for actual paths)

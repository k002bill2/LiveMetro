---
description: Check the status of running KiiPS services
---

# Check KiiPS Service Status

Check which KiiPS services are currently running and their port status.

**Usage:** `/service-status`

**Instructions for Claude:**

1. Check for running Java processes related to KiiPS:
   ```bash
   ps aux | grep -i kiips | grep -v grep
   ```

2. Check which ports are in use by KiiPS services:
   ```bash
   lsof -i :8000-9000 | grep LISTEN
   ```

3. For each service found, report:
   - Service name
   - Port number
   - Process ID
   - Running status

4. Cross-reference with standard KiiPS port allocation:
   - API Gateway: 8000
   - Login: 8801
   - Common: 8701
   - UI: 8100
   - FD (Fund): 8601
   - IL (Investment): 8401
   - PG (Program): 8201

5. Provide a summary table of service status

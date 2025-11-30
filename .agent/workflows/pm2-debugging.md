---
description: PM2 Backend Debugging and Process Management
---

# PM2 Backend Debugging Workflow

This workflow guides you through managing and debugging backend microservices using PM2.

## 1. Installation (If not installed)

```bash
npm install -g pm2
# or
pnpm add -g pm2
```

## 2. Configuration (ecosystem.config.js)

Ensure you have an `ecosystem.config.js` file in your project root.

```javascript
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      script: 'npm',
      args: 'start',
      cwd: './api-gateway',
      error_file: './api-gateway/logs/error.log',
      out_file: './api-gateway/logs/out.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      }
    },
    // Add other services here
  ]
};
```

## 3. Common Commands

### Start Services
```bash
pm2 start ecosystem.config.js
```

### Check Status
```bash
pm2 status
pm2 monit
```

### View Logs
```bash
# All logs
pm2 logs

# Specific service logs
pm2 logs api-gateway
pm2 logs email-service --lines 100
```

### Restarting
```bash
# Restart specific service
pm2 restart api-gateway

# Restart all
pm2 restart all
```

## 4. Debugging Workflow

1.  **Identify the Issue**: Use `pm2 status` to see if any service is errored or restarting loop.
2.  **Check Logs**: Use `pm2 logs [service-name] --err` to see error logs specifically.
3.  **Analyze**: Look for stack traces or error messages in the logs.
4.  **Fix**: Apply code fixes.
5.  **Restart**: Run `pm2 restart [service-name]` to apply changes.
6.  **Verify**: Check logs again to ensure the error is gone.

## 5. Pro Tips

-   Use `pm2 flush` to clear old logs if they are too noisy.
-   Use `pm2 reload` instead of `restart` for zero-downtime reloads (if supported).
-   Watch mode: `pm2 start ecosystem.config.js --watch` (use carefully in dev).

---
description: Backend microservices debugging and management using PM2
---

# PM2 Backend Debugging System

## 🎯 PM2 Installation and Setup

### Installation
```bash
npm install -g pm2
```

### Create ecosystem.config.js
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
    }
    // Additional services...
  ]
};
```

## 🎮 PM2 Core Commands

### Basic Commands
```bash
# Start
pm2 start ecosystem.config.js

# Check status
pm2 list

# View logs
pm2 logs                    # All services
pm2 logs [service]          # Specific service
pm2 logs [service] --lines 100  # Recent 100 lines

# Restart
pm2 restart all
pm2 restart [service]

# Stop
pm2 stop all
pm2 stop [service]
```

### Monitoring
```bash
# Real-time monitoring
pm2 monit

# Detailed information
pm2 show [service]
```

## 🔧 Using with Claude

### Add to CLAUDE.md
```markdown
## Backend Services

All backend services are managed by PM2:

### Debugging
\`\`\`bash
# Check service status
pm2 list

# View logs for specific service
pm2 logs [service-name] --lines 200

# Restart problematic service
pm2 restart [service-name]
\`\`\`
```

### Claude Prompt Example
```bash
"The email service is returning 500 errors. 
Check the logs and debug the issue."

# Claude executes:
# pm2 logs email --lines 200
# pm2 show email
# pm2 restart email
```

## 📝 Log Management

### Log Rotation Setup
```bash
# Install PM2 log rotation
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## 💡 Pro Tips

### Development vs Production
```bash
# Development environment (watch mode)
pm2 start app.js --watch --ignore-watch="node_modules"

# Production (cluster mode)
pm2 start app.js -i max --env production
```

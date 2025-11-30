FROM node:20-alpine

# Install build dependencies for native modules (tree-sitter)
RUN apk add --no-cache python3 make g++ git

# Install task-master-ai globally
RUN npm install -g task-master-ai

# Clean up build dependencies to reduce image size
RUN apk del python3 make g++

# Set working directory
WORKDIR /app/project

# Default command to run the MCP server
ENTRYPOINT ["task-master-ai"]

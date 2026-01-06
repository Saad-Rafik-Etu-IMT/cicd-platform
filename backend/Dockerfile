# ========================================
# CI/CD Backend - Node.js
# ========================================
FROM node:20-alpine

WORKDIR /app

# Install dependencies for SSH and Git
RUN apk add --no-cache git openssh-client docker-cli curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy source code
COPY src ./src

# Create ssh directory
RUN mkdir -p /app/ssh

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Run application
CMD ["node", "src/server.js"]

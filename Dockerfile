# AudioForge Development Dockerfile
FROM node:18

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose development port
EXPOSE 5000

# Start development server
CMD ["npm", "run", "dev"]
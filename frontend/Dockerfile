# Use the official Node.js 20 image
FROM node:20

# Set the working directory inside the container
WORKDIR /app

ENV DATABASE_URL=postgresql://neondb_owner:pOhY1VrFUw8m@ep-black-scene-a1qxsve5.ap-southeast-1.aws.neon.tech/cloudcode?sslmode=require

ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bmF0dXJhbC1yYXQtNTkuY2xlcmsuYWNjb3VudHMuZGV2JA
ENV CLERK_SECRET_KEY=sk_test_0YRNG0IulDpt3IkKjCQCr9CTdd7rd9lL4bCA5Pgx05

# Install pnpm globally
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml (if it exists)
COPY package*.json pnpm-lock.yaml* ./

# Install dependencies using pnpm
RUN pnpm install

# Copy the rest of the application code
COPY . .

# Expose the frontend port (default for React apps)
EXPOSE 3000

# Command to run the application
CMD ["pnpm", "run", "dev"]

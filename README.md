# AI-Powered News Watch (Veille AI)

This project is a monorepo application that automates the process of searching for news articles, summarizing them, generating presentations, and distributing them.

## Features

- **Automated Workflow:** Search, ingest, summarize, generate, and distribute news articles with a single command.
- **Web Interface:** A simple and intuitive web interface for creating and monitoring workflow runs.
- **Dockerized:** The entire application is containerized for easy deployment and scalability.
- **CI/CD:** A minimal CI/CD pipeline is set up with GitHub Actions for automated builds and Docker image publishing.

## Tech Stack

- **Monorepo:** pnpm workspaces
- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL, Redis, BullMQ
- **Frontend:** React, Vite, Tailwind CSS, TanStack Query, Zod
- **External Services:** Tavily, Jina Reader, OpenAI, Gamma, Google Drive, Gmail

## Local Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-name>
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**
    -   Copy the `.env.example` file in `apps/api` to `.env`.
    -   Fill in the required API keys and OAuth credentials.

4.  **Start the application:**
    ```bash
    docker-compose up -d
    ```

5.  **Run database migrations:**
    ```bash
    pnpm db:migrate
    ```

The application will be available at the following URLs:
-   **Web App:** `http://localhost:5173`
-   **API Server:** `http://localhost:3000`
-   **Bull Board UI:** `http://localhost:3000/admin/queues`
-   **Prisma Studio:** `http://localhost:5555`

## Scripts

-   `pnpm dev`: Start the development servers for the API and web app.
-   `pnpm build`: Build the API and web app for production.
-   `pnpm start`: Start the API server in production mode.
-   `pnpm db:migrate`: Apply database migrations.
-   `pnpm db:studio`: Open Prisma Studio.
-   `pnpm seed`: Seed the database with initial data.

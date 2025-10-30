# Operations

This document provides information on how to operate and maintain the AI-Powered News Watch application.

## Key Management

All API keys and OAuth credentials are managed through environment variables. See the `.env.example` file in `apps/api` for a complete list of required variables.

## External Service Limits

Be mindful of the rate limits and quotas for the external services used in this application:

-   **Tavily:** Refer to the Tavily API documentation for rate limits.
-   **Jina Reader:** Refer to the Jina Reader API documentation for rate limits.
-   **OpenAI:** Refer to the OpenAI API documentation for rate limits and token limits.
-   **Gamma:** Refer to the Gamma API documentation for rate limits.
-   **Google Drive:** Refer to the Google Drive API documentation for rate limits.
-   **Gmail:** Refer to the Gmail API documentation for rate limits.

## Troubleshooting

-   **Failed Jobs:** Use the Bull Board UI at `http://localhost:3000/admin/queues` to monitor and retry failed jobs.
-   **Database Issues:** Use Prisma Studio at `http://localhost:5555` to inspect and manage the database.
-   **Application Logs:** Check the logs of the `api` and `web` containers in Docker for any errors.
-   **OAuth Issues:** Ensure that your Google OAuth 2.0 credentials are correct and that you have granted the necessary permissions.

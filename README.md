## Prerequisites

Before you start, ensure that you have the following installed:

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/SuMayaBee/CodeMentor.git
   cd https://github.com/SuMayaBee/CodeMentor.git
   ```

2. Create a `.env` file in the project root directory (where `docker-compose.yaml` is located) and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```



3. Build the Docker images:
   ```bash
   docker compose build
   ```

4. Start the services:
   ```bash
   docker compose up
   ```

   The frontend and backend will now be running. You can access them at the URLs specified in the `docker-compose.yaml` file (commonly `http://localhost:3000` for the frontend and `http://localhost:8000` for the backend).


## Troubleshooting

- Ensure that your `.env` file is correctly placed and contains a valid `OPENAI_API_KEY`.
- Check that Docker and Docker Compose are correctly installed and running on your machine.
- If you encounter issues, try stopping the containers with `docker compose down` and restarting them with `docker compose up`.

## Feedback and Contributions

We welcome contributions and feedback! Feel free to open an issue or submit a pull request to improve the project.


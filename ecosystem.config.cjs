module.exports = {
  apps: [
    {
      name: "soapi-backend",
      script: "venv/bin/uvicorn",
      args: "backend.main:app --host 0.0.0.0 --port 8000",
      interpreter: "none",
      restart_delay: 3000,
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
    {
      name: "soapi-frontend",
      script: ".output/server/index.mjs",
      interpreter: "node",
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        FASTAPI_URL: "http://127.0.0.1:8000",
      },
    },
  ],
};

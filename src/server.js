import { createApp } from "./app.js";
import { assertRuntimeEnv, env } from "./config/env.js";
import { cleanupStaleUploads, ensureUploadDirectory } from "./utils/files.js";
import {
  closeMailTransport,
  verifyMailTransport,
} from "./services/mail.service.js";

const start = async () => {
  assertRuntimeEnv();
  await ensureUploadDirectory();
  await cleanupStaleUploads();

  if (env.verifySmtpOnStartup) {
    await verifyMailTransport();
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(
      JSON.stringify({
        level: "info",
        event: "server_started",
        port: env.port,
        environment: env.nodeEnv,
        mailTransport: env.mailTransport,
      })
    );
  });

  const shutdown = (signal) => {
    console.log(
      JSON.stringify({ level: "info", event: "server_stopping", signal })
    );

    server.close(() => {
      closeMailTransport();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start().catch((error) => {
  console.error(
    JSON.stringify({
      level: "fatal",
      event: "server_start_failed",
      error: error.message,
    })
  );
  closeMailTransport();
  process.exit(1);
});

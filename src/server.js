import { createApp } from "./app.js";
import { assertRuntimeEnv, env } from "./config/env.js";
import { cleanupStaleUploads, ensureUploadDirectory } from "./utils/files.js";
import {
  closeMailTransport,
  verifyMailTransport,
} from "./services/mail.service.js";

assertRuntimeEnv();

const app = createApp();

const listen = () =>
  app.listen(env.port, () => {
    console.log(
      JSON.stringify({
        level: "info",
        event: "server_started",
        port: env.port,
        environment: env.nodeEnv,
        platform: env.isVercel ? "vercel" : "node",
        mailTransport: env.mailTransport,
      })
    );
  });

let server;

if (env.isVercel) {
  // Vercel menangkap server Express dari listen() saat module dimuat.
  server = listen();
} else {
  await ensureUploadDirectory();
  await cleanupStaleUploads();

  if (env.verifySmtpOnStartup) {
    await verifyMailTransport();
  }

  server = listen();
}

if (!env.isVercel) {
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
}

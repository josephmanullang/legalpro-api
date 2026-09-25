import app from "./app.js";
import { env } from "./config/env.js";
import { cleanupStaleUploads, ensureUploadDirectory } from "./utils/files.js";
import {
  closeMailTransport,
  verifyMailTransport,
} from "./services/mail.service.js";

if (!env.isVercel) {
  let server;

  const startServer = async () => {
    await ensureUploadDirectory();
    await cleanupStaleUploads();

    if (env.verifySmtpOnStartup) {
      await verifyMailTransport();
    }

    server = app.listen(env.port, () => {
      console.log(
        JSON.stringify({
          level: "info",
          event: "server_started",
          port: env.port,
          environment: env.nodeEnv,
          platform: "node",
          mailTransport: env.mailTransport,
        })
      );
    });
  };

  const shutdown = (signal) => {
    console.log(
      JSON.stringify({ level: "info", event: "server_stopping", signal })
    );

    if (!server) {
      closeMailTransport();
      process.exit(0);
      return;
    }

    server.close(() => {
      closeMailTransport();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  startServer().catch((error) => {
    console.error(
      JSON.stringify({
        level: "fatal",
        event: "server_start_failed",
        error: error.message,
      })
    );
    process.exit(1);
  });
}

export default app;

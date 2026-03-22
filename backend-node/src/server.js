const { connectDb, closeDb } = require("./db");
const { app, ensureDefaultAdmin } = require("./app");
const { config } = require("./config");

const start = async () => {
  try {
    await connectDb();
    await ensureDefaultAdmin();

    app.listen(config.port, "0.0.0.0", () => {
      // eslint-disable-next-line no-console
      console.log(`Dial For Help Node backend running on 0.0.0.0:${config.port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start Node backend", error);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  await closeDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDb();
  process.exit(0);
});

start();
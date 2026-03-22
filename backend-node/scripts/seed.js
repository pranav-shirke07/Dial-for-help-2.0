const { connectDb, closeDb, getDb } = require("../src/db");
const { seedDemoData } = require("../src/seedDemoData");

const run = async () => {
  try {
    await connectDb();
    const result = await seedDemoData(getDb());
    // eslint-disable-next-line no-console
    console.log("Seed completed", result);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Seed failed", error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
};

run();
import { db } from "./db.js";
import { logger } from "./logger.js";
import { reapOrphanRuns, runWorkerLoop } from "./worker.js";

async function main() {
  logger.info("worker ready");

  await db.$connect();
  logger.info("database connected");

  await reapOrphanRuns();

  await runWorkerLoop();
}

main().catch((err) => {
  logger.error("fatal error", { error: String(err) });
  process.exit(1);
});

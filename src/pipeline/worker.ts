import { processNextJob } from "./process-job";
import { createServiceClient, loadLocalEnv } from "./supabase";

loadLocalEnv();

const supabase = createServiceClient();
let stopped = false;

process.on("SIGINT", () => {
  stopped = true;
});

process.on("SIGTERM", () => {
  stopped = true;
});

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

console.info("Course Memo worker is polling processing_jobs");

async function main() {
  while (!stopped) {
    try {
      const worked = await processNextJob(supabase);
      if (!worked) {
        await sleep(2000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Worker error";
      console.error(message);
      await sleep(2000);
    }
  }
}

void main();

import type { PgBoss } from "pg-boss";

let workerBoss: PgBoss | undefined;

export function setWorkerBoss(boss: PgBoss): void {
  workerBoss = boss;
}

export function getWorkerBoss(): PgBoss {
  if (!workerBoss) {
    throw new Error("Worker queue is not ready.");
  }
  return workerBoss;
}

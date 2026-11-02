import type { EntityManager } from "typeorm";

export async function resolveManager(manager?: EntityManager): Promise<EntityManager> {
  if (manager) {
    return manager;
  }

  // In the Next.js app, lib/db/index.ts manages a single initialized connection
  // with a globalThis cache. Use it when available (it imports server-only so
  // it is never bundled into the worker or test environments).
  try {
    const { getDataSource } = await import("../../db/index");
    const dataSource = await getDataSource();
    return dataSource.manager;
  } catch {
    // Fallback for worker and test environments where server-only is not available.
    const { default: dataSource } = await import("../../db/data-source");
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    return dataSource.manager;
  }
}

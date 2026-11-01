import type { EntityManager } from "typeorm";

export async function resolveManager(manager?: EntityManager): Promise<EntityManager> {
  if (manager) {
    return manager;
  }

  const { default: dataSource } = await import("../../db/data-source");
  return dataSource.manager;
}

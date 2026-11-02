import type { DataSource } from "typeorm";
import dataSource from "../../lib/db/data-source";

let initialization: Promise<DataSource> | undefined;

export async function getWorkerDataSource(): Promise<DataSource> {
  if (dataSource.isInitialized) {
    return dataSource;
  }
  initialization ??= dataSource.initialize();
  return initialization;
}

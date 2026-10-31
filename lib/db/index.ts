import "server-only";
import { DataSource } from "typeorm";
import dataSource from "./data-source";

/**
 * This module is the app's database client. It must only be imported from
 * server code running on the Node.js runtime (never from the Edge runtime or a
 * client component) - `server-only` makes a client import a build error.
 *
 * When entities are added later, any relation property should use `Relation<T>`
 * from "typeorm" (instead of importing the related entity class only for its
 * type) to avoid circular import errors between entity files.
 */

const globalForDb = globalThis as unknown as {
  __collateDbConnection?: Promise<DataSource>;
};

function initialize(): Promise<DataSource> {
  // Cache the promise (not the instance) so concurrent calls during startup or
  // HMR share one initialization and never open two pools.
  return dataSource.initialize();
}

export function getDataSource(): Promise<DataSource> {
  globalForDb.__collateDbConnection ??= initialize();
  return globalForDb.__collateDbConnection;
}

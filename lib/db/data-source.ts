import "reflect-metadata";
import "dotenv/config";
import { DataSource, EntitySchema } from "typeorm";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in the connection string from your database provider.",
  );
}

// SSL: DATABASE_SSL=true enables SSL. The rejectUnauthorized:false setting
// accepts any server certificate, which is fine for most managed providers but
// production should instead use the provider's CA certificate.
const ssl =
  process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false;

/**
 * Entities are imported explicitly as classes (never via a glob path) and
 * added to this list as they are created in later issues.
 *
 * The list deliberately carries a real type: only entity classes or
 * TypeORM EntitySchema objects belong in it, so a stray module import fails
 * type-checking instead of confusing the driver at runtime.
 */
type AnyEntity = EntitySchema | (new (...args: never[]) => object);

const entities: AnyEntity[] = [];

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl,
  // Keep the pool small to respect cloud provider connection limits.
  extra: { max: 5 },
  entities,
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  // Schema changes only ever happen through migrations.
  synchronize: false,
  logging: ["error"],
});

// Single export: the TypeORM CLI refuses data source files with more than one
// exported DataSource instance.
export default dataSource;

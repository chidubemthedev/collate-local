import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { entities } from "./entities";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in the connection string from your database provider.",
  );
}

const ssl =
  process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false;

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl,
  extra: { max: 5 },
  entities,
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false,
  logging: ["error"],
});

export default dataSource;

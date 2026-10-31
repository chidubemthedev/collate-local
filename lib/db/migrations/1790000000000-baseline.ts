import { MigrationInterface } from "typeorm";

/**
 * Harmless baseline so `npm run db:migrate` has something to run before the
 * first real tables are added in later issues.
 */
export class Baseline1790000000000 implements MigrationInterface {
  public async up(): Promise<void> {
    // No-op: no tables exist yet.
  }

  public async down(): Promise<void> {
    // No-op: nothing to undo.
  }
}

import type { QueryRunner } from "typeorm";
import { createHash, randomBytes } from "node:crypto";
import { AccessLink } from "../../entities/access-link.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { ImportBatch } from "../../entities/import-batch.entity";
import { demoIp, demoPhone, writeDemoTokenFile } from "./utils";

export async function seedOperations(queryRunner: QueryRunner): Promise<void> {
  const candidateRows = await queryRunner.query(`
    SELECT c.id, c.person_id FROM candidate c
    INNER JOIN person p ON p.id = c.person_id
    WHERE p.email_address LIKE '%@demo.collate.test%'
    ORDER BY c.id;
  `) as Array<{ id: number; person_id: string }>;

  const tokenOutputs: Array<{ candidatePersonId: string; token: string }> = [];
  for (let index = 0; index < candidateRows.length; index += 1) {
    const candidate = candidateRows[index];
    const token = randomBytes(18).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + (index % 3 === 0 ? 3 : index % 2 === 0 ? 12 : 30) * 24 * 60 * 60 * 1000);
    const isRevoked = index % 10 === 0;
    const isExpired = index % 7 === 0;

    await queryRunner.query(`
      INSERT INTO access_link (candidate_id, token_hash, expires_at, is_revoked)
      VALUES (${candidate.id}, '${tokenHash}', '${(isExpired ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : expiresAt).toISOString()}', ${isRevoked})
    `);

    if (!isRevoked && !isExpired) {
      tokenOutputs.push({ candidatePersonId: candidate.person_id, token });
    }
  }

  await writeDemoTokenFile(tokenOutputs);

  const uploaderRows = await queryRunner.query(`SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%' ORDER BY full_name LIMIT 3;`) as Array<{ id: string }>;
  const batches = [
    { fileName: "lagos-agent-import.csv", total: 240, imported: 224, errors: 16 },
    { fileName: "anambra-agent-import.csv", total: 180, imported: 166, errors: 14 },
    { fileName: "kano-agent-import.csv", total: 210, imported: 190, errors: 20 },
  ];

  for (const [index, batch] of batches.entries()) {
    await queryRunner.query(`
      INSERT INTO import_batch (file_name, uploader_person_id, total_row_count, imported_row_count, error_row_count, error_details)
      VALUES (
        '${batch.fileName}',
        '${uploaderRows[index % uploaderRows.length]?.id ?? uploaderRows[0].id}',
        ${batch.total},
        ${batch.imported},
        ${batch.errors},
        '{"rowNumbers":[2,19,31],"codes":["INVALID_PHONE","DUPLICATE_PHONE"]}'::jsonb
      );
    `);
  }

  const demoActors = await queryRunner.query(`SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%' ORDER BY full_name;`) as Array<{ id: string }>;
  const actions = ["login", "view_agents", "view_coverage", "import_agents", "send_broadcast", "create_access_link", "revoke_access_link"];
  const targetTypes = ["person", "group", "agent_assignment", "coverage_count", "broadcast"];

  const auditRows: string[] = [];
  for (let index = 0; index < 150; index += 1) {
    const actor = demoActors[index % demoActors.length];
    const action = actions[index % actions.length];
    const targetType = targetTypes[index % targetTypes.length];
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000));
    const ip = demoIp(index + 1);
    auditRows.push(`('${actor?.id ?? demoActors[0].id}', '${action}', '${targetType}', '${(index + 1).toString()}', '${ip}', '${createdAt.toISOString()}')`);
  }

  if (auditRows.length > 0) {
    await queryRunner.query(`
      INSERT INTO audit_log (actor_person_id, action_type, target_entity_type, target_entity_id, ip_address, created_at)
      VALUES ${auditRows.join(", ")};
    `);
  }
}

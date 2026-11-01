import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Person } from "./person.entity";

@Entity("import_batch")
export class ImportBatch {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "file_name", type: "varchar" })
  fileName: string;

  @Column({ name: "uploader_person_id", type: "uuid" })
  uploaderPersonId: string;

  @ManyToOne(() => Person, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "uploader_person_id" })
  uploaderPerson: Relation<Person>;

  @Column({ name: "total_row_count", type: "int", default: 0 })
  totalRowCount: number;

  @Column({ name: "imported_row_count", type: "int", default: 0 })
  importedRowCount: number;

  @Column({ name: "error_row_count", type: "int", default: 0 })
  errorRowCount: number;

  @Column({ name: "error_details", type: "jsonb", nullable: true })
  errorDetails: Record<string, unknown> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

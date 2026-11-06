import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Person } from "./person.entity";

@Entity("consent")
@Index("ix_consent_person_id_created_at", ["personId", "createdAt", "id"])
export class Consent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "person_id", type: "uuid" })
  personId: string;

  @ManyToOne(() => Person, (person) => person.consents, { onDelete: "CASCADE" })
  @JoinColumn({ name: "person_id" })
  person: Relation<Person>;

  @Column({ name: "consent_text_version", type: "varchar" })
  consentTextVersion: string;

  @Column({ name: "is_accepted", type: "boolean" })
  isAccepted: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

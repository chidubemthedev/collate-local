import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { Person } from "./person.entity";

@Entity("consent")
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

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

@Entity("auth_session")
export class AuthSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("ix_auth_session_person_id")
  @Column({ name: "person_id", type: "uuid" })
  personId: string;

  @ManyToOne(() => Person, (person) => person.authSessions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "person_id" })
  person: Relation<Person>;

  @Column({ name: "session_token_hash", type: "varchar", unique: true })
  sessionTokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "last_active_at", type: "timestamptz" })
  lastActiveAt: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @Column({ name: "created_from_ip", type: "varchar", nullable: true })
  createdFromIp: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

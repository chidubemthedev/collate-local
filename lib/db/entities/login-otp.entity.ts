import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { Person } from "./person.entity";

@Entity("login_otp")
export class LoginOtp {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("ix_login_otp_person_id_created_at", ["personId", "createdAt"])
  @Column({ name: "person_id", type: "uuid" })
  personId: string;

  @ManyToOne(() => Person, (person) => person.loginOtps, { onDelete: "CASCADE" })
  @JoinColumn({ name: "person_id" })
  person: Relation<Person>;

  @Column({ name: "code_hash", type: "varchar" })
  codeHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "consumed_at", type: "timestamptz", nullable: true })
  consumedAt: Date | null;

  @Column({ name: "failed_attempt_count", type: "int", default: 0 })
  failedAttemptCount: number;

  @Column({ name: "requested_from_ip", type: "varchar", nullable: true })
  requestedFromIp: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

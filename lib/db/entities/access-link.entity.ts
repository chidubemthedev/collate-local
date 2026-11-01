import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Candidate } from "./candidate.entity";

@Entity("access_link")
export class AccessLink {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "candidate_id", type: "int" })
  candidateId: number;

  @ManyToOne(() => Candidate, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "candidate_id" })
  candidate: Relation<Candidate>;

  @Column({ name: "token_hash", type: "varchar", unique: true })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "is_revoked", type: "boolean", default: false })
  isRevoked: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

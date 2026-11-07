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
import { Candidate } from "./candidate.entity";
import { Person } from "./person.entity";

/**
 * A candidate's invite: a single-use link, emailed by an admin, that the candidate opens to
 * complete registration. Only the SHA-256 hash of the link's token is stored.
 */
@Entity("invite_access_link")
export class InviteAccessLink {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("ix_invite_access_link_candidate_id")
  @Column({ name: "candidate_id", type: "int" })
  candidateId: number;

  @ManyToOne(() => Candidate, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "candidate_id", foreignKeyConstraintName: "fk_invite_access_link_candidate" })
  candidate: Relation<Candidate>;

  /** Where the invite went. Saved on the candidate's person only when they complete registration. */
  @Column({ name: "email_address", type: "varchar" })
  emailAddress: string;

  @Column({ name: "token_hash", type: "varchar", unique: true })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "is_revoked", type: "boolean", default: false })
  isRevoked: boolean;

  /** When the candidate completed registration; the link can't be used again. */
  @Column({ name: "accepted_at", type: "timestamptz", nullable: true })
  acceptedAt: Date | null;

  @Column({ name: "invited_by_person_id", type: "uuid", nullable: true })
  invitedByPersonId: string | null;

  @ManyToOne(() => Person, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "invited_by_person_id", foreignKeyConstraintName: "fk_invite_access_link_invited_by" })
  invitedBy: Relation<Person | null>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

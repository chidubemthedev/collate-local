import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Candidate } from "./candidate.entity";
import { Group } from "./group.entity";
import { Person } from "./person.entity";
import { PollingUnit } from "./polling-unit.entity";

export enum AgentKind {
  OFFICIAL = "official",
  EXTRA = "extra",
}

@Entity("agent_assignment")
@Check("((owner_group_id IS NOT NULL) <> (owner_candidate_id IS NOT NULL))")
@Check(
  "(agent_kind = 'official' AND slot_number = 0) OR (agent_kind = 'extra' AND slot_number >= 1)",
)
export class AgentAssignment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("ix_agent_assignment_person_id")
  @Column({ name: "person_id", type: "uuid" })
  personId: string;

  @ManyToOne(() => Person, (person) => person.agentAssignments, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "person_id" })
  person: Relation<Person>;

  @Index("ix_agent_assignment_polling_unit_id")
  @Column({ name: "polling_unit_id", type: "int" })
  pollingUnitId: number;

  @ManyToOne(() => PollingUnit, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "polling_unit_id" })
  pollingUnit: Relation<PollingUnit>;

  @Column({ name: "owner_group_id", type: "int", nullable: true })
  ownerGroupId: number | null;

  @ManyToOne(() => Group, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "owner_group_id" })
  ownerGroup: Relation<Group | null>;

  @Column({ name: "owner_candidate_id", type: "int", nullable: true })
  ownerCandidateId: number | null;

  @ManyToOne(() => Candidate, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "owner_candidate_id" })
  ownerCandidate: Relation<Candidate | null>;

  @Column({
    name: "agent_kind",
    type: "enum",
    enum: AgentKind,
  })
  agentKind: AgentKind;

  @Column({ name: "slot_number", type: "smallint", default: 0 })
  slotNumber: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}

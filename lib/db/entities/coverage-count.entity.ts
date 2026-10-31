import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { Candidate } from "./candidate.entity";
import { Group } from "./group.entity";
import { Lga } from "./lga.entity";
import { PoliticalUnit } from "./political-unit.entity";
import { State } from "./state.entity";
import { Ward } from "./ward.entity";

export enum CoverageKind {
  HEADLINE = "headline",
  GROUP = "group",
}

@Entity("coverage_count")
@Check("num_nonnulls(unit_state_id, unit_lga_id, unit_ward_id, unit_political_unit_id) = 1")
@Check("covered_polling_unit_count <= total_polling_unit_count")
export class CoverageCount {
  @PrimaryGeneratedColumn("bigint")
  id: string;

  @Column({ name: "unit_state_id", type: "int", nullable: true })
  unitStateId: number | null;

  @ManyToOne(() => State, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "unit_state_id" })
  unitState: Relation<State | null>;

  @Column({ name: "unit_lga_id", type: "int", nullable: true })
  unitLgaId: number | null;

  @ManyToOne(() => Lga, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "unit_lga_id" })
  unitLga: Relation<Lga | null>;

  @Column({ name: "unit_ward_id", type: "int", nullable: true })
  unitWardId: number | null;

  @ManyToOne(() => Ward, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "unit_ward_id" })
  unitWard: Relation<Ward | null>;

  @Column({ name: "unit_political_unit_id", type: "int", nullable: true })
  unitPoliticalUnitId: number | null;

  @ManyToOne(() => PoliticalUnit, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "unit_political_unit_id" })
  unitPoliticalUnit: Relation<PoliticalUnit | null>;

  @Column({ name: "owner_group_id", type: "int", nullable: true })
  ownerGroupId: number | null;

  @ManyToOne(() => Group, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "owner_group_id" })
  ownerGroup: Relation<Group | null>;

  @Column({ name: "owner_candidate_id", type: "int", nullable: true })
  ownerCandidateId: number | null;

  @ManyToOne(() => Candidate, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "owner_candidate_id" })
  ownerCandidate: Relation<Candidate | null>;

  @Column({
    name: "coverage_kind",
    type: "enum",
    enum: CoverageKind,
  })
  coverageKind: CoverageKind;

  @Column({ name: "covered_polling_unit_count", type: "int" })
  coveredPollingUnitCount: number;

  @Column({ name: "total_polling_unit_count", type: "int" })
  totalPollingUnitCount: number;

  @Column({ name: "refreshed_at", type: "timestamptz" })
  refreshedAt: Date;

  @Index("ix_coverage_count_scope", [
    "unitStateId",
    "unitLgaId",
    "unitWardId",
    "unitPoliticalUnitId",
    "ownerGroupId",
    "ownerCandidateId",
    "coverageKind",
  ])
  scopeIndex?: number | string | null;
}

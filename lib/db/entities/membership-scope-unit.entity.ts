import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Lga } from "./lga.entity";
import { Membership } from "./membership.entity";
import { PoliticalUnit } from "./political-unit.entity";
import { State } from "./state.entity";
import { Ward } from "./ward.entity";

@Entity("membership_scope_unit")
@Check("num_nonnulls(scope_state_id, scope_lga_id, scope_ward_id, scope_political_unit_id) = 1")
export class MembershipScopeUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @Index("ix_membership_scope_unit_membership_id")
  @Column({ name: "membership_id", type: "int" })
  membershipId: number;

  @ManyToOne(() => Membership, (membership) => membership.membershipScopeUnits, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "membership_id" })
  membership: Relation<Membership>;

  @Column({ name: "scope_state_id", type: "int", nullable: true })
  scopeStateId: number | null;

  @ManyToOne(() => State, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "scope_state_id" })
  scopeState: Relation<State | null>;

  @Column({ name: "scope_lga_id", type: "int", nullable: true })
  scopeLgaId: number | null;

  @ManyToOne(() => Lga, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "scope_lga_id" })
  scopeLga: Relation<Lga | null>;

  @Column({ name: "scope_ward_id", type: "int", nullable: true })
  scopeWardId: number | null;

  @ManyToOne(() => Ward, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "scope_ward_id" })
  scopeWard: Relation<Ward | null>;

  @Column({ name: "scope_political_unit_id", type: "int", nullable: true })
  scopePoliticalUnitId: number | null;

  @ManyToOne(() => PoliticalUnit, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "scope_political_unit_id" })
  scopePoliticalUnit: Relation<PoliticalUnit | null>;
}

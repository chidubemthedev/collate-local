import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
} from "typeorm";
import { Group } from "./group.entity";
import { MembershipScopeUnit } from "./membership-scope-unit.entity";
import { Person } from "./person.entity";

@Entity("membership")
@Unique("uq_membership_person_group", ["personId", "groupId"])
export class Membership {
  @PrimaryGeneratedColumn()
  id: number;

  @Index("ix_membership_person_id")
  @Column({ name: "person_id", type: "uuid" })
  personId: string;

  @ManyToOne(() => Person, (person) => person.memberships, { onDelete: "CASCADE" })
  @JoinColumn({ name: "person_id" })
  person: Relation<Person>;

  @Index("ix_membership_group_id")
  @Column({ name: "group_id", type: "int" })
  groupId: number;

  @ManyToOne(() => Group, { onDelete: "CASCADE" })
  @JoinColumn({ name: "group_id" })
  group: Relation<Group>;

  @Column({ name: "membership_role", type: "varchar", length: 50 })
  membershipRole: string;

  @OneToMany(() => MembershipScopeUnit, (scopeUnit) => scopeUnit.membership)
  membershipScopeUnits: Relation<MembershipScopeUnit[]>;
}

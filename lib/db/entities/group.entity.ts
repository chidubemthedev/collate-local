import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { GroupTypeRecord } from "./group-type.entity";

/** Keys of the four built-in group types (group_type.type_key). Types an admin adds have no key. */
export enum GroupType {
  PARTY = "party",
  CAMPAIGN = "campaign",
  SUPPORT_GROUP = "support_group",
  ADMIN = "admin",
}

@Entity("groups")
export class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "group_name", type: "varchar" })
  groupName: string;

  @Column({ name: "group_type_id", type: "int" })
  groupTypeId: number;

  @ManyToOne(() => GroupTypeRecord, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "group_type_id" })
  groupType: Relation<GroupTypeRecord>;

  @Column({ name: "parent_group_id", type: "int", nullable: true })
  parentGroupId: number | null;

  @ManyToOne(() => Group, (group) => group.childGroups, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "parent_group_id" })
  parentGroup: Relation<Group | null>;

  @OneToMany(() => Group, (group) => group.parentGroup)
  childGroups: Relation<Group[]>;
}

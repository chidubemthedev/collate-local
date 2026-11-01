import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
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

  @Column({
    name: "group_type",
    type: "enum",
    enum: GroupType,
  })
  groupType: GroupType;

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

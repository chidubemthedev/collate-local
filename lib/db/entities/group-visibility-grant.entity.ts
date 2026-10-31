import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Relation } from "typeorm";
import { Group } from "./group.entity";

@Entity("group_visibility_grant")
export class GroupVisibilityGrant {
  @PrimaryColumn({ name: "viewer_group_id", type: "int" })
  viewerGroupId: number;

  @PrimaryColumn({ name: "owner_group_id", type: "int" })
  ownerGroupId: number;

  @ManyToOne(() => Group, { onDelete: "CASCADE" })
  @JoinColumn({ name: "viewer_group_id" })
  viewerGroup: Relation<Group>;

  @ManyToOne(() => Group, { onDelete: "CASCADE" })
  @JoinColumn({ name: "owner_group_id" })
  ownerGroup: Relation<Group>;

  @Column({ name: "is_allowed", type: "boolean", default: true })
  isAllowed: boolean;
}

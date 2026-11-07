import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum GroupCanMessage {
  NONE = "none",
  AGENTS_THEY_COVER = "agents_they_cover",
  ALL_AGENTS = "all_agents",
}

export enum GroupSeesCoverage {
  NATIONAL = "national",
  OWN_AREA = "own_area",
}

/**
 * A kind of group and what its members may do (Settings · Groups and access).
 * The four built-in types have a fixed key ("admin", "party", "campaign", "support_group");
 * types an admin creates have none.
 */
@Entity("group_type")
export class GroupTypeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "type_key", type: "varchar", length: 40, nullable: true, unique: true })
  typeKey: string | null;

  @Column({ name: "type_name", type: "varchar", length: 80 })
  typeName: string;

  @Column({ name: "can_message", type: "enum", enum: GroupCanMessage, enumName: "group_can_message" })
  canMessage: GroupCanMessage;

  @Column({ name: "sees_coverage", type: "enum", enum: GroupSeesCoverage, enumName: "group_sees_coverage" })
  seesCoverage: GroupSeesCoverage;

  @Column({ name: "can_own_agents", type: "boolean", default: true })
  canOwnAgents: boolean;

  @Column({ name: "is_system", type: "boolean", default: false })
  isSystem: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

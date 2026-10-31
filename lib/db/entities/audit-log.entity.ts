import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { Person } from "./person.entity";

@Entity("audit_log")
export class AuditLog {
  @PrimaryGeneratedColumn("bigint")
  id: string;

  @Column({ name: "actor_person_id", type: "uuid", nullable: true })
  actorPersonId: string | null;

  @ManyToOne(() => Person, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "actor_person_id" })
  actorPerson: Relation<Person | null>;

  @Column({ name: "action_type", type: "varchar" })
  actionType: string;

  @Column({ name: "target_entity_type", type: "varchar", nullable: true })
  targetEntityType: string | null;

  @Column({ name: "target_entity_id", type: "varchar", nullable: true })
  targetEntityId: string | null;

  @Column({ name: "ip_address", type: "varchar", nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @Index("ix_audit_log_actor_person_id_created_at", ["actorPersonId", "createdAt"])
  actorPersonCreatedAtIndex?: string | Date;

  @Index("ix_audit_log_target_entity", ["targetEntityType", "targetEntityId"])
  targetEntityIndex?: string | null;
}

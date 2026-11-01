import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Person } from "./person.entity";

export enum BroadcastStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  SENDING = "sending",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

@Entity("broadcast")
export class Broadcast {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "sender_person_id", type: "uuid" })
  senderPersonId: string;

  @ManyToOne(() => Person, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "sender_person_id" })
  senderPerson: Relation<Person>;

  @Column({ name: "audience_filter", type: "jsonb" })
  audienceFilter: Record<string, unknown>;

  @Column({ name: "message_text", type: "text" })
  messageText: string;

  @Column({ name: "scheduled_send_at", type: "timestamptz", nullable: true })
  scheduledSendAt: Date | null;

  @Column({
    name: "broadcast_status",
    type: "enum",
    enum: BroadcastStatus,
    default: BroadcastStatus.DRAFT,
  })
  broadcastStatus: BroadcastStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

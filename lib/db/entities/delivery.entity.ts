import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
} from "typeorm";
import { Broadcast } from "./broadcast.entity";
import { Person } from "./person.entity";

export enum DeliveryChannel {
  TELEGRAM = "telegram",
  SMS = "sms",
}

export enum DeliveryStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  DELIVERED_BY_SMS = "delivered_by_sms",
  FAILED = "failed",
  TAPPED_OK = "tapped_ok",
}

@Entity("delivery")
@Unique("uq_delivery_broadcast_person", ["broadcastId", "personId"])
export class Delivery {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("ix_delivery_broadcast_id")
  @Column({ name: "broadcast_id", type: "uuid" })
  broadcastId: string;

  @ManyToOne(() => Broadcast, { onDelete: "CASCADE" })
  @JoinColumn({ name: "broadcast_id" })
  broadcast: Relation<Broadcast>;

  @Index("ix_delivery_person_id")
  @Column({ name: "person_id", type: "uuid" })
  personId: string;

  @ManyToOne(() => Person, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "person_id" })
  person: Relation<Person>;

  @Column({
    name: "delivery_channel",
    type: "enum",
    enum: DeliveryChannel,
  })
  deliveryChannel: DeliveryChannel;

  @Column({
    name: "delivery_status",
    type: "enum",
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  deliveryStatus: DeliveryStatus;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt: Date | null;

  @Column({ name: "delivered_at", type: "timestamptz", nullable: true })
  deliveredAt: Date | null;

  @Column({ name: "tapped_ok_at", type: "timestamptz", nullable: true })
  tappedOkAt: Date | null;

  @Column({ name: "failed_at", type: "timestamptz", nullable: true })
  failedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

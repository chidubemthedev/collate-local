// Sensitive personal data. Never log. Mask in the UI. Encrypted at rest by the database provider (confirm).
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { Person } from "./person.entity";

@Entity("phone_number")
export class PhoneNumber {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "person_id", type: "uuid" })
  personId: string;

  @ManyToOne(() => Person, (person) => person.phoneNumbers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "person_id" })
  person: Relation<Person>;

  @Column({ name: "e164_number", type: "varchar" })
  e164Number: string;

  @Column({ name: "is_confirmed", type: "boolean", default: false })
  isConfirmed: boolean;

  @Column({ name: "telegram_chat_id", type: "bigint", nullable: true })
  telegramChatId: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @Check("e164_number ~ '^\\+[1-9][0-9]{6,14}$'")
  e164Check?: string;

  @Index("uq_phone_number_telegram_chat_id", ["telegramChatId"], { unique: true })
  telegramIndex?: string | null;
}

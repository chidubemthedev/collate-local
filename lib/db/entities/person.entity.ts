// Sensitive personal data. Never log. Mask in the UI. Encrypted at rest by the database provider (confirm).
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { AgentAssignment } from "./agent-assignment.entity";
import { AuthSession } from "./auth-session.entity";
import { Candidate } from "./candidate.entity";
import { Consent } from "./consent.entity";
import { LoginOtp } from "./login-otp.entity";
import { Membership } from "./membership.entity";
import { PhoneNumber } from "./phone-number.entity";
import { PollingUnit } from "./polling-unit.entity";

export enum VerificationStatus {
  UNVERIFIED = "unverified",
  VERIFIED = "verified",
  REJECTED = "rejected",
}

@Entity("person")
export class Person {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "full_name", type: "varchar" })
  fullName: string;

  @Column({ name: "home_polling_unit_id", type: "int", nullable: true })
  homePollingUnitId: number | null;

  @ManyToOne(() => PollingUnit, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "home_polling_unit_id" })
  homePollingUnit: Relation<PollingUnit | null>;

  @Index("uq_person_email_address_lower", ["emailAddress"], { unique: true })
  @Column({ name: "email_address", type: "varchar", nullable: true })
  emailAddress: string | null;

  @Column({ name: "voter_card_number", type: "varchar", nullable: true })
  voterCardNumber: string | null;

  @Column({
    name: "verification_status",
    type: "enum",
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
  })
  verificationStatus: VerificationStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @OneToMany(() => PhoneNumber, (phoneNumber) => phoneNumber.person)
  phoneNumbers: Relation<PhoneNumber[]>;

  @OneToMany(() => Consent, (consent) => consent.person)
  consents: Relation<Consent[]>;

  @OneToMany(() => Candidate, (candidate) => candidate.person)
  candidates: Relation<Candidate[]>;

  @OneToMany(() => Membership, (membership) => membership.person)
  memberships: Relation<Membership[]>;

  @OneToMany(() => AuthSession, (authSession) => authSession.person)
  authSessions: Relation<AuthSession[]>;

  @OneToMany(() => LoginOtp, (loginOtp) => loginOtp.person)
  loginOtps: Relation<LoginOtp[]>;

  @OneToMany(() => AgentAssignment, (assignment) => assignment.person)
  agentAssignments: Relation<AgentAssignment[]>;
}

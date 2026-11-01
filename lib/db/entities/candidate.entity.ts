import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Person } from "./person.entity";
import { Seat } from "./seat.entity";

@Entity("candidate")
@Check("principal_candidate_id IS DISTINCT FROM id")
@Check("(seat_id IS NOT NULL) <> (principal_candidate_id IS NOT NULL)")
export class Candidate {
  @PrimaryGeneratedColumn()
  id: number;

  @Index("ix_candidate_person_id")
  @Column({ name: "person_id", type: "uuid" })
  personId: string;

  @ManyToOne(() => Person, (person) => person.candidates, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "person_id" })
  person: Relation<Person>;

  @Index("ix_candidate_seat_id", ["seatId"])
  @Column({ name: "seat_id", type: "int", nullable: true })
  seatId: number | null;

  @ManyToOne(() => Seat, (seat) => seat.candidates, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "seat_id" })
  seat: Relation<Seat | null>;

  @Index("ix_candidate_principal_candidate_id", ["principalCandidateId"])
  @Column({ name: "principal_candidate_id", type: "int", nullable: true })
  principalCandidateId: number | null;

  @ManyToOne(() => Candidate, (candidate) => candidate.runningMates, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "principal_candidate_id" })
  principalCandidate: Relation<Candidate | null>;

  @OneToMany(() => Candidate, (candidate) => candidate.principalCandidate)
  runningMates: Relation<Candidate[]>;
}

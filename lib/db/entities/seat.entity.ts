import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique
} from "typeorm";
import type { Relation } from "typeorm";
import { Candidate } from "./candidate.entity";
import { Office } from "./office.entity";
import { PoliticalUnit } from "./political-unit.entity";

@Entity("seat")
@Unique("uq_seat_office_political_unit", ["officeId", "politicalUnitId"])
export class Seat {
  @PrimaryGeneratedColumn()
  id: number;

  @Index("ix_seat_office_id", ["officeId"])
  @Column({ name: "office_id", type: "int" })
  officeId: number;

  @Index("ix_seat_political_unit_id", ["politicalUnitId"])
  @Column({ name: "political_unit_id", type: "int" })
  politicalUnitId: number;

  @ManyToOne(() => Office, (office) => office.seats, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "office_id" })
  office: Relation<Office>;

  @ManyToOne(() => PoliticalUnit, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "political_unit_id" })
  politicalUnit: Relation<PoliticalUnit>;

  @OneToMany(() => Candidate, (candidate) => candidate.seat)
  candidates: Relation<Candidate[]>;
}

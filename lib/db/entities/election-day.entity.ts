import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Relation } from "typeorm";
import { ElectionDayOffCycleState } from "./election-day-off-cycle-state.entity";
import { ElectionDayOffice } from "./election-day-office.entity";

@Entity("election_day")
export class ElectionDay {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "election_date", type: "date", unique: true })
  electionDate: Date;

  @Column({ name: "election_label", type: "varchar", nullable: true })
  electionLabel: string | null;

  @OneToMany(() => ElectionDayOffice, (item) => item.electionDay)
  offices: Relation<ElectionDayOffice[]>;

  @OneToMany(() => ElectionDayOffCycleState, (item) => item.electionDay)
  offCycleStates: Relation<ElectionDayOffCycleState[]>;
}

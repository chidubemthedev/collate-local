import { Entity, JoinColumn, ManyToOne, PrimaryColumn, Relation } from "typeorm";
import { ElectionDay } from "./election-day.entity";
import { Office } from "./office.entity";

@Entity("election_day_office")
export class ElectionDayOffice {
  @PrimaryColumn({ name: "election_day_id", type: "int" })
  electionDayId: number;

  @PrimaryColumn({ name: "office_id", type: "int" })
  officeId: number;

  @ManyToOne(() => ElectionDay, (electionDay) => electionDay.offices, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "election_day_id" })
  electionDay: Relation<ElectionDay>;

  @ManyToOne(() => Office, { onDelete: "CASCADE" })
  @JoinColumn({ name: "office_id" })
  office: Relation<Office>;
}

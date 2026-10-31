import { Entity, JoinColumn, ManyToOne, PrimaryColumn, Relation } from "typeorm";
import { ElectionDay } from "./election-day.entity";
import { State } from "./state.entity";

@Entity("election_day_off_cycle_state")
export class ElectionDayOffCycleState {
  @PrimaryColumn({ name: "election_day_id", type: "int" })
  electionDayId: number;

  @PrimaryColumn({ name: "state_id", type: "int" })
  stateId: number;

  @ManyToOne(() => ElectionDay, (electionDay) => electionDay.offCycleStates, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "election_day_id" })
  electionDay: Relation<ElectionDay>;

  @ManyToOne(() => State, { onDelete: "CASCADE" })
  @JoinColumn({ name: "state_id" })
  state: Relation<State>;
}

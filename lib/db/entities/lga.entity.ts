import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { State } from "./state.entity";
import { Ward } from "./ward.entity";

@Entity("lga")
@Index("uq_lga_state_inec_code", ["stateId", "inecLgaCode"], { unique: true })
export class Lga {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "state_id", type: "int" })
  stateId: number;

  @Column({ name: "inec_lga_code", type: "varchar" })
  inecLgaCode: string;

  @Column({ name: "lga_name", type: "varchar" })
  lgaName: string;

  @ManyToOne(() => State, (state) => state.lgas, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "state_id" })
  state: Relation<State>;

  @OneToMany(() => Ward, (ward) => ward.lga)
  wards: Relation<Ward[]>;
}

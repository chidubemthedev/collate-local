import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Lga } from "./lga.entity";

@Entity("state")
export class State {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "inec_state_code", type: "varchar", unique: true })
  inecStateCode: string;

  @Column({ name: "state_name", type: "varchar" })
  stateName: string;

  @OneToMany(() => Lga, (lga) => lga.state)
  lgas: Relation<Lga[]>;
}

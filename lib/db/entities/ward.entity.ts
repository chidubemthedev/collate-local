import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { Lga } from "./lga.entity";
import { PollingUnit } from "./polling-unit.entity";

@Entity("ward")
@Index("uq_ward_lga_inec_code", ["lgaId", "inecWardCode"], { unique: true })
export class Ward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "lga_id", type: "int" })
  lgaId: number;

  @Column({ name: "inec_ward_code", type: "varchar" })
  inecWardCode: string;

  @Column({ name: "ward_name", type: "varchar" })
  wardName: string;

  @ManyToOne(() => Lga, (lga) => lga.wards, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "lga_id" })
  lga: Relation<Lga>;

  @OneToMany(() => PollingUnit, (pollingUnit) => pollingUnit.ward)
  pollingUnits: Relation<PollingUnit[]>;
}

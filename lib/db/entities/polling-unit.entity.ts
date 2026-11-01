import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { Ward } from "./ward.entity";
import { PuPoliticalUnit } from "./pu-political-unit.entity";

@Entity("polling_unit")
export class PollingUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "inec_polling_unit_code", type: "varchar", unique: true })
  inecPollingUnitCode: string;

  @Column({ name: "polling_unit_name", type: "varchar", nullable: true })
  pollingUnitName: string | null;

  @Column({ name: "ward_id", type: "int" })
  wardId: number;

  @Column({ name: "latitude", type: "double precision", nullable: true })
  latitude: number | null;

  @Column({ name: "longitude", type: "double precision", nullable: true })
  longitude: number | null;

  @Column({ name: "is_position_doubtful", type: "boolean", default: false })
  isPositionDoubtful: boolean;

  @ManyToOne(() => Ward, (ward) => ward.pollingUnits, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "ward_id" })
  ward: Relation<Ward>;

  @OneToMany(() => PuPoliticalUnit, (link) => link.pollingUnit)
  politicalUnits: Relation<PuPoliticalUnit[]>;
}

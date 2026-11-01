import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { PollingUnit } from "./polling-unit.entity";
import { PoliticalUnit } from "./political-unit.entity";

@Entity("pu_political_unit")
export class PuPoliticalUnit {
  @PrimaryColumn({ name: "political_unit_id", type: "int" })
  politicalUnitId: number;

  @PrimaryColumn({ name: "polling_unit_id", type: "int" })
  pollingUnitId: number;

  @ManyToOne(() => PoliticalUnit, (politicalUnit) => politicalUnit.pollingUnits, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "political_unit_id" })
  politicalUnit: Relation<PoliticalUnit>;

  @ManyToOne(() => PollingUnit, (pollingUnit) => pollingUnit.politicalUnits, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "polling_unit_id" })
  pollingUnit: Relation<PollingUnit>;
}

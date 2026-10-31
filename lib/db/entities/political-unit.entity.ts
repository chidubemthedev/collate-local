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
import { PuPoliticalUnit } from "./pu-political-unit.entity";

export enum PoliticalUnitType {
  COUNTRY = "country",
  STATE = "state",
  SENATORIAL_DISTRICT = "senatorial_district",
  FEDERAL_CONSTITUENCY = "federal_constituency",
  STATE_CONSTITUENCY = "state_constituency",
}

@Entity("political_unit")
@Index("ix_political_unit_type_parent", ["politicalUnitType", "parentPoliticalUnitId"])
export class PoliticalUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "political_unit_name", type: "varchar" })
  politicalUnitName: string;

  @Column({
    name: "political_unit_type",
    type: "enum",
    enum: PoliticalUnitType,
  })
  politicalUnitType: PoliticalUnitType;

  @Column({ name: "parent_political_unit_id", type: "int", nullable: true })
  parentPoliticalUnitId: number | null;

  @ManyToOne(() => PoliticalUnit, (politicalUnit) => politicalUnit.children, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "parent_political_unit_id" })
  parentPoliticalUnit: Relation<PoliticalUnit | null>;

  @OneToMany(() => PoliticalUnit, (politicalUnit) => politicalUnit.parentPoliticalUnit)
  children: Relation<PoliticalUnit[]>;

  @OneToMany(() => PuPoliticalUnit, (link) => link.politicalUnit)
  pollingUnits: Relation<PuPoliticalUnit[]>;
}

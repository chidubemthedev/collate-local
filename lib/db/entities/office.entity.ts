import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import type { Relation } from "typeorm";
import { PoliticalUnitType } from "./political-unit.entity";
import { Seat } from "./seat.entity";

@Entity("office")
export class Office {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "office_name", type: "varchar", unique: true })
  officeName: string;

  @Column({ name: "hierarchy_level", type: "int" })
  hierarchyLevel: number;

  @Column({
    name: "political_unit_type",
    type: "enum",
    enum: PoliticalUnitType,
  })
  politicalUnitType: PoliticalUnitType;

  @OneToMany(() => Seat, (seat) => seat.office)
  seats: Relation<Seat[]>;
}

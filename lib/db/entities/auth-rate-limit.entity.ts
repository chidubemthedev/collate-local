import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique
} from "typeorm";
@Entity("auth_rate_limit")
@Unique("uq_auth_rate_limit_bucket_window", ["bucketKey", "windowStartedAt"])
export class AuthRateLimit {
  @PrimaryGeneratedColumn("identity", { type: "bigint" })
  id: string;

  @Column({ name: "bucket_key", type: "varchar" })
  bucketKey: string;

  @Column({ name: "window_started_at", type: "timestamptz" })
  windowStartedAt: Date;

  @Column({ name: "hit_count", type: "int", default: 0 })
  hitCount: number;
}

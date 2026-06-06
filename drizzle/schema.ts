import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 다음 달 부과 대상자 테이블
export const billingCandidates = mysqlTable("billing_candidates", {
  id: int("id").autoincrement().primaryKey(),
  sourceSystemId: varchar("source_system_id", { length: 50 }).notNull(),
  managementNo: varchar("management_no", { length: 50 }),
  region: varchar("region", { length: 50 }),
  vehicleNo: varchar("vehicle_no", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  rrn: varchar("rrn", { length: 14 }),
  mobile: varchar("mobile", { length: 20 }),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  certificateDate: date("certificate_date"),
  certificateNo: varchar("certificate_no", { length: 50 }),
  licenseNo: varchar("license_no", { length: 50 }),
  vehicleType: varchar("vehicle_type", { length: 50 }),
  fuelType: varchar("fuel_type", { length: 50 }),
  businessNo: varchar("business_no", { length: 20 }),
  company: varchar("company", { length: 100 }),
  joinDate: date("join_date"),
  memo: text("memo"),
  memberType: varchar("member_type", { length: 20 }).notNull(), // 개인회원, 택배회원
  billingType: varchar("billing_type", { length: 20 }).notNull(), // 협회비, 관리비
  // 기존 length 7(YYYY-MM)로는 2018-11-24 같은 부과시작일 저장 시 MySQL insert 실패.
  billingStartMonth: varchar("billing_start_month", { length: 10 }).notNull(), // YYYY-MM-DD 또는 빈값
  status: varchar("status", { length: 20 }).default("대기").notNull(), // 대기, 부과예정, 부과반영완료, 확인필요, 보류, 제외
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BillingCandidate = typeof billingCandidates.$inferSelect;
export type InsertBillingCandidate = typeof billingCandidates.$inferInsert;

// 폐업/양도/이관 이력 테이블
export const closureEvents = mysqlTable("closure_events", {
  id: int("id").autoincrement().primaryKey(),
  sourceSystemId: varchar("source_system_id", { length: 50 }).notNull(),
  closureType: varchar("closure_type", { length: 20 }).notNull(), // 폐업, 양도, 이관
  managementNo: varchar("management_no", { length: 50 }).notNull(),
  region: varchar("region", { length: 50 }),
  vehicleNo: varchar("vehicle_no", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  receiptDate: date("receipt_date"),
  processDate: date("process_date").notNull(),
  excludeStartMonth: varchar("exclude_start_month", { length: 10 }).notNull(), // YYYY-MM-DD 또는 YYYY-MM
  unpaidAmountAtClosure: int("unpaid_amount_at_closure").default(0),
  reflectStatus: varchar("reflect_status", { length: 20 }).default("확인필요").notNull(), // 반영완료, 미수금있음, 확인필요, 보류
  memo: text("memo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ClosureEvent = typeof closureEvents.$inferSelect;
export type InsertClosureEvent = typeof closureEvents.$inferInsert;

// 연동 로그 테이블
export const syncLogs = mysqlTable("sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // REGISTER, CLOSURE 등
  sourceId: varchar("source_id", { length: 50 }),
  targetId: varchar("target_id", { length: 50 }),
  status: varchar("status", { length: 20 }).notNull(), // SUCCESS, FAIL, WARNING
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;

// 납부현황 테이블
export const billingRecords = mysqlTable("billing_records", {
  id: int("id").autoincrement().primaryKey(),
  billingCandidateId: int("billing_candidate_id").notNull(),
  billingMonth: varchar("billing_month", { length: 7 }).notNull(), // YYYY-MM
  amount: int("amount").notNull(), // 협회비 10000 또는 관리비 5000
  isPaid: int("is_paid").default(0), // 0: 미납, 1: 납부
  paidDate: date("paid_date"),
  paidAmount: int("paid_amount").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BillingRecord = typeof billingRecords.$inferSelect;
export type InsertBillingRecord = typeof billingRecords.$inferInsert;

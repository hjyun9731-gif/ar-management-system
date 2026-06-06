import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, billingCandidates, closureEvents, syncLogs, billingRecords, InsertBillingCandidate, InsertClosureEvent, InsertSyncLog, InsertBillingRecord } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Billing Candidates queries
export async function getBillingCandidates(filters?: {
  region?: string;
  memberType?: string;
  status?: string;
  billingStartMonth?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query: any = db.select().from(billingCandidates);

  if (filters?.region) {
    query = query.where(eq(billingCandidates.region, filters.region));
  }
  if (filters?.memberType) {
    query = query.where(eq(billingCandidates.memberType, filters.memberType));
  }
  if (filters?.status) {
    query = query.where(eq(billingCandidates.status, filters.status));
  }
  if (filters?.billingStartMonth) {
    query = query.where(like(billingCandidates.billingStartMonth, filters.billingStartMonth + "%"));
  }

  return await query;
}

export async function getBillingCandidateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(billingCandidates).where(eq(billingCandidates.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createBillingCandidate(data: InsertBillingCandidate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(billingCandidates).values(data);
  return result;
}

export async function updateBillingCandidate(id: number, data: Partial<InsertBillingCandidate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(billingCandidates).set({ ...data, updatedAt: new Date() }).where(eq(billingCandidates.id, id));
}

// Closure Events queries
export async function getClosureEvents(filters?: {
  closureType?: string;
  reflectStatus?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query: any = db.select().from(closureEvents);

  if (filters?.closureType) {
    query = query.where(eq(closureEvents.closureType, filters.closureType));
  }
  if (filters?.reflectStatus) {
    query = query.where(eq(closureEvents.reflectStatus, filters.reflectStatus));
  }

  return await query;
}

export async function createClosureEvent(data: InsertClosureEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(closureEvents).values(data);
}

// Sync Logs queries
export async function createSyncLog(data: InsertSyncLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(syncLogs).values(data);
}

export async function getSyncLogs(filters?: {
  eventType?: string;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query: any = db.select().from(syncLogs);

  if (filters?.eventType) {
    query = query.where(eq(syncLogs.eventType, filters.eventType));
  }
  if (filters?.status) {
    query = query.where(eq(syncLogs.status, filters.status));
  }

  return await query;
}

// Billing Records queries
export async function getBillingRecords(billingCandidateId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (billingCandidateId) {
    return await db.select().from(billingRecords).where(eq(billingRecords.billingCandidateId, billingCandidateId));
  }
  return await db.select().from(billingRecords);
}

export async function createBillingRecord(data: InsertBillingRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(billingRecords).values(data);
}



import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@test.com",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("billing router", () => {
  describe("getDashboardStats", () => {
    it("should return dashboard statistics", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const stats = await caller.billing.getDashboardStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("nextMonthCount");
      expect(stats).toHaveProperty("thisMonthCount");
      expect(stats).toHaveProperty("closurePendingCount");
      expect(stats).toHaveProperty("unpaidCount");
      expect(stats).toHaveProperty("confirmNeededCount");
      expect(typeof stats.nextMonthCount).toBe("number");
      expect(typeof stats.thisMonthCount).toBe("number");
    });
  });

  describe("listCandidates", () => {
    it("should list billing candidates", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const candidates = await caller.billing.listCandidates({});

      expect(Array.isArray(candidates)).toBe(true);
    });

    it("should filter by status", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const candidates = await caller.billing.listCandidates({
        status: "대기",
      });

      expect(Array.isArray(candidates)).toBe(true);
    });
  });

  describe("listClosures", () => {
    it("should list closure events", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const closures = await caller.billing.listClosures({});

      expect(Array.isArray(closures)).toBe(true);
    });
  });

  describe("listSyncLogs", () => {
    it("should list sync logs", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const logs = await caller.billing.listSyncLogs({});

      expect(Array.isArray(logs)).toBe(true);
    });

    it("should filter by status", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const logs = await caller.billing.listSyncLogs({
        status: "SUCCESS",
      });

      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe("listBillingRecords", () => {
    it("should list billing records", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const records = await caller.billing.listBillingRecords({});

      expect(Array.isArray(records)).toBe(true);
    });
  });

  describe("syncMembers", () => {
    it("should register a new billing candidate", async () => {
      const caller = appRouter.createCaller({} as TrpcContext);

      const result = await caller.billing.syncMembers({
        sourceSystemId: "test-source-001",
        vehicleNo: "12가3456",
        name: "테스트 회원",
        memberType: "개인회원",
        registrationDate: new Date().toISOString(),
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("success");
      expect(result.candidateId).toBeDefined();
    });

    it("should detect duplicate and set to confirm status", async () => {
      const caller = appRouter.createCaller({} as TrpcContext);

      // First registration
      const result1 = await caller.billing.syncMembers({
        sourceSystemId: "test-source-002",
        vehicleNo: "12가7890",
        name: "중복 테스트",
        memberType: "개인회원",
        registrationDate: new Date().toISOString(),
      });

      expect(result1.status).toBe("success");

      // Duplicate registration
      const result2 = await caller.billing.syncMembers({
        sourceSystemId: "test-source-003",
        vehicleNo: "12가7890",
        name: "중복 테스트",
        memberType: "개인회원",
        registrationDate: new Date().toISOString(),
      });

      expect(result2.status).toBe("warning");
      expect(result2.message).toContain("중복");
    });
  });

  describe("syncClosures", () => {
    it("should handle closure event", async () => {
      const caller = appRouter.createCaller({} as TrpcContext);

      // First create a candidate
      const candidateResult = await caller.billing.syncMembers({
        sourceSystemId: "test-source-004",
        vehicleNo: "12나1111",
        name: "폐업 테스트",
        memberType: "개인회원",
        registrationDate: new Date().toISOString(),
      });

      expect(candidateResult.status).toBe("success");

      // Then register closure
      const closureResult = await caller.billing.syncClosures({
        sourceSystemId: "test-source-005",
        closureType: "폐업",
        managementNo: "MGT-001",
        vehicleNo: "12나1111",
        name: "폐업 테스트",
        processDate: new Date().toISOString(),
      });

      expect(closureResult.status).toBe("success");
      expect(closureResult.message).toContain("폐업");
    });
  });
});

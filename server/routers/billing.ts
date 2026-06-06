import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getBillingCandidates,
  getBillingCandidateById,
  createBillingCandidate,
  updateBillingCandidate,
  getClosureEvents,
  createClosureEvent,
  createSyncLog,
  getSyncLogs,
  getBillingRecords,
  createBillingRecord,
} from "../db";
import { TRPCError } from "@trpc/server";

// 부과시작월 자동 계산 함수
// 택배회원: certificateDate 기준 다음 달
// 개인회원: joinDate 기준 다음 달
function calculateBillingStartMonth(
  memberType: string,
  joinDate?: string | Date,
  certificateDate?: string | Date
): string | null {
  let baseDate: Date | null = null;

  if (memberType === "택배회원" && certificateDate) {
    baseDate = new Date(certificateDate);
  } else if (memberType === "개인회원" && joinDate) {
    baseDate = new Date(joinDate);
  }

  if (!baseDate) {
    return null; // 필수 날짜 없음
  }

  const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
}

// 중복 체크 함수
async function checkDuplicate(data: {
  rrn?: string;
  vehicleNo: string;
  name: string;
}): Promise<number | null> {
  const candidates = await getBillingCandidates();
  const list = await candidates;

  // 1순위: 주민등록번호
  if (data.rrn) {
    const found = list.find((c: any) => c.rrn === data.rrn);
    if (found) return found.id;
  }

  // 2순위: 차량번호
  const vehicleMatch = list.find((c: any) => c.vehicleNo === data.vehicleNo);
  if (vehicleMatch) return vehicleMatch.id;

  // 3순위: 성명 + 차량번호 뒤 4자리
  const vehicleLast4 = data.vehicleNo.slice(-4);
  const nameVehicleMatch = list.find(
    (c: any) => c.name === data.name && c.vehicleNo.slice(-4) === vehicleLast4
  );
  if (nameVehicleMatch) return nameVehicleMatch.id;

  return null;
}

// 부과항목 결정 함수
// 택배회원: certificateDate 존재 시만 관리비
// 개인회원: joinDate 존재 시만 협회비
// 필수 날짜 없으면 확인필요
function determineBillingType(
  memberType: string,
  joinDate?: string | Date,
  certificateDate?: string | Date
): { billingType: string; status: string } {
  if (memberType === "개인회원") {
    if (joinDate) {
      return { billingType: "협회비", status: "대기" };
    } else {
      return { billingType: "확인필요", status: "확인필요" };
    }
  }

  if (memberType === "택배회원") {
    if (certificateDate) {
      return { billingType: "관리비", status: "대기" };
    } else {
      return { billingType: "확인필요", status: "확인필요" };
    }
  }

  return { billingType: "확인필요", status: "확인필요" };
}

// ---- Import preview / apply types ----

const registerRowSchema = z.object({
  type: z.literal("REGISTER"),
  sourceSystemId: z.string(),
  managementNo: z.string().optional(),
  region: z.string().optional(),
  vehicleNo: z.string(),
  name: z.string(),
  rrn: z.string().optional(),
  mobile: z.string().optional(),
  memberType: z.enum(["개인회원", "택배회원"]),
  joinDate: z.string().optional(),
  certificateDate: z.string().optional(),
  vehicleType: z.string().optional(),
  businessNo: z.string().optional(),
  company: z.string().optional(),
  memo: z.string().optional(),
});

const closureRowSchema = z.object({
  type: z.literal("CLOSURE"),
  sourceSystemId: z.string(),
  closureType: z.enum(["폐업", "양도", "이관"]),
  managementNo: z.string(),
  region: z.string().optional(),
  vehicleNo: z.string(),
  name: z.string(),
  processDate: z.string(),
  receiptDate: z.string().optional(),
});

const importRowSchema = z.discriminatedUnion("type", [registerRowSchema, closureRowSchema]);

type ImportRow = z.infer<typeof importRowSchema>;

interface PreviewRegisterItem {
  rowIndex: number;
  type: "REGISTER";
  category: "신규" | "중복의심" | "날짜누락" | "확인필요";
  sourceSystemId: string;
  vehicleNo: string;
  name: string;
  memberType: string;
  billingType: string;
  billingStartMonth: string;
  status: string;
  duplicateId?: number;
  reason?: string;
  raw: z.infer<typeof registerRowSchema>;
}

interface PreviewClosureItem {
  rowIndex: number;
  type: "CLOSURE";
  category: "폐업양도이관";
  sourceSystemId: string;
  vehicleNo: string;
  name: string;
  closureType: string;
  excludeStartMonth: string;
  matchedCandidateId?: number;
  reason?: string;
  raw: z.infer<typeof closureRowSchema>;
}

type PreviewItem = PreviewRegisterItem | PreviewClosureItem;

async function buildPreview(rows: ImportRow[]): Promise<PreviewItem[]> {
  const allCandidates = await getBillingCandidates();
  const list: any[] = await allCandidates;

  const items: PreviewItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.type === "REGISTER") {
      // duplicate check
      let duplicateId: number | undefined;
      if (row.rrn) {
        const found = list.find((c: any) => c.rrn === row.rrn);
        if (found) duplicateId = found.id;
      }
      if (!duplicateId) {
        const found = list.find((c: any) => c.vehicleNo === row.vehicleNo);
        if (found) duplicateId = found.id;
      }
      if (!duplicateId) {
        const last4 = row.vehicleNo.slice(-4);
        const found = list.find((c: any) => c.name === row.name && c.vehicleNo.slice(-4) === last4);
        if (found) duplicateId = found.id;
      }

      const billingStartMonth = calculateBillingStartMonth(row.memberType, row.joinDate, row.certificateDate);
      const { billingType, status } = determineBillingType(row.memberType, row.joinDate, row.certificateDate);

      let category: PreviewRegisterItem["category"];
      let reason: string | undefined;

      if (duplicateId) {
        category = "중복의심";
        reason = `기존 ID ${duplicateId}와 차량번호/주민번호 중복`;
      } else if (status === "확인필요") {
        const missing = row.memberType === "개인회원" ? "joinDate" : "certificateDate";
        category = "날짜누락";
        reason = `${missing} 누락`;
      } else {
        category = "신규";
      }

      items.push({
        rowIndex: i,
        type: "REGISTER",
        category,
        sourceSystemId: row.sourceSystemId,
        vehicleNo: row.vehicleNo,
        name: row.name,
        memberType: row.memberType,
        billingType,
        billingStartMonth: billingStartMonth || "",
        status,
        duplicateId,
        reason,
        raw: row,
      });
    } else {
      // CLOSURE
      const processDate = new Date(row.processDate);
      const nextMonthVal = processDate.getMonth() + 2;
      const nextYear = nextMonthVal > 12 ? processDate.getFullYear() + 1 : processDate.getFullYear();
      const nextMonth = nextMonthVal > 12 ? nextMonthVal - 12 : nextMonthVal;
      const excludeStartMonth = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;

      const matched = list.find(
        (c: any) => c.vehicleNo === row.vehicleNo || c.managementNo === row.managementNo
      );

      items.push({
        rowIndex: i,
        type: "CLOSURE",
        category: "폐업양도이관",
        sourceSystemId: row.sourceSystemId,
        vehicleNo: row.vehicleNo,
        name: row.name,
        closureType: row.closureType,
        excludeStartMonth,
        matchedCandidateId: matched?.id,
        reason: matched ? undefined : "부과 대상자 미등록 (신규 등록 필요)",
        raw: row,
      });
    }
  }

  return items;
}

export const billingRouter = router({
  // 신규 등록 연동 API
  syncMembers: publicProcedure
    .input(
      z.object({
        sourceSystemId: z.string(),
        managementNo: z.string().optional(),
        region: z.string().optional(),
        vehicleNo: z.string(),
        name: z.string(),
        rrn: z.string().optional(),
        mobile: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        certificateDate: z.string().optional(),
        certificateNo: z.string().optional(),
        licenseNo: z.string().optional(),
        vehicleType: z.string().optional(),
        fuelType: z.string().optional(),
        businessNo: z.string().optional(),
        company: z.string().optional(),
        joinDate: z.string().optional(),
        memo: z.string().optional(),
        memberType: z.enum(["개인회원", "택배회원"]),
        registrationDate: z.string(),
        approvalDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // 중복 체크
        const duplicateId = await checkDuplicate({
          rrn: input.rrn,
          vehicleNo: input.vehicleNo,
          name: input.name,
        });

        if (duplicateId) {
          // 중복 발견 시 기존 데이터 업데이트 또는 확인필요 상태로 변경
          await updateBillingCandidate(duplicateId, {
            status: "확인필요",
            memo: `중복 데이터: ${input.sourceSystemId}`,
          });

          await createSyncLog({
            eventType: "REGISTER",
            sourceId: input.sourceSystemId,
            targetId: String(duplicateId),
            status: "WARNING",
            message: "중복 데이터 발견 - 확인필요 상태로 변경",
          });

          return {
            status: "warning",
            message: "중복 데이터가 발견되어 확인필요 상태로 변경되었습니다.",
            candidateId: duplicateId,
          };
        }

        // 부과시작월 계산
        const billingStartMonth = calculateBillingStartMonth(
          input.memberType,
          input.joinDate,
          input.certificateDate
        );

        // 부과항목 결정
        const { billingType, status: determinedStatus } = determineBillingType(
          input.memberType,
          input.joinDate,
          input.certificateDate
        );

        // 신규 대상자 생성
        const result: any = await createBillingCandidate({
          sourceSystemId: input.sourceSystemId,
          managementNo: input.managementNo,
          region: input.region,
          vehicleNo: input.vehicleNo,
          name: input.name,
          rrn: input.rrn,
          mobile: input.mobile,
          address: input.address,
          phone: input.phone,
          certificateDate: input.certificateDate ? new Date(input.certificateDate) : undefined,
          certificateNo: input.certificateNo,
          licenseNo: input.licenseNo,
          vehicleType: input.vehicleType,
          fuelType: input.fuelType,
          businessNo: input.businessNo,
          company: input.company,
          joinDate: input.joinDate ? new Date(input.joinDate) : undefined,
          memo: input.memo,
          memberType: input.memberType,
          billingType,
          billingStartMonth: billingStartMonth || "",  // 부과시작월 없으면 빈 문자열
          status: determinedStatus,
        });

        const candidateId = result?.insertId || 1;

        // 연동 로그 기록
        const logMessage =
          determinedStatus === "확인필요"
            ? `필수 정보 부족 - ${input.memberType === "개인회원" ? "joinDate" : "certificateDate"} 확인 필요`
            : `${billingType} 대상자로 등록 (부과시작월: ${billingStartMonth})`;

        await createSyncLog({
          eventType: "REGISTER",
          sourceId: input.sourceSystemId,
          targetId: String(candidateId),
          status: determinedStatus === "확인필요" ? "WARNING" : "SUCCESS",
          message: logMessage,
        });

        return {
          status: determinedStatus === "확인필요" ? "warning" : "success",
          message:
            determinedStatus === "확인필요"
              ? `필수 정보 부족으로 확인필요 상태로 등록되었습니다.`
              : `${billingType} 대상자로 등록되었습니다. (부과시작월: ${billingStartMonth})`,
          candidateId,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        await createSyncLog({
          eventType: "REGISTER",
          sourceId: input.sourceSystemId,
          status: "FAIL",
          message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  // 폐업/양도/이관 연동 API
  syncClosures: publicProcedure
    .input(
      z.object({
        sourceSystemId: z.string(),
        closureType: z.enum(["폐업", "양도", "이관"]),
        managementNo: z.string(),
        region: z.string().optional(),
        vehicleNo: z.string(),
        name: z.string(),
        receiptDate: z.string().optional(),
        processDate: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // 해당 회원 찾기
        const candidates = await getBillingCandidates();
        const list = await candidates;
        const member = list.find(
          (c: any) => (c as any)?.vehicleNo === input.vehicleNo || (c as any)?.managementNo === input.managementNo
        );

        if (!member) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "해당 회원을 찾을 수 없습니다.",
          });
        }

        // 제외시작월 계산
        const processDate = new Date(input.processDate);
        const excludeStartMonth = `${processDate.getFullYear()}-${String(
          processDate.getMonth() + 2
        ).padStart(2, "0")}`;

        // 폐업 이벤트 생성
        const closureResult: any = await createClosureEvent({
          sourceSystemId: input.sourceSystemId,
          closureType: input.closureType,
          managementNo: input.managementNo,
          region: input.region,
          vehicleNo: input.vehicleNo,
          name: input.name,
          receiptDate: input.receiptDate ? new Date(input.receiptDate) : undefined,
          processDate: new Date(input.processDate),
          excludeStartMonth,
          unpaidAmountAtClosure: 0, // 미수금 joq마 로직 아직
          reflectStatus: "확인필요",
        });

        const closureId = closureResult?.insertId || 1;

        // 해당 회원의 부과 상태를 "제외"로 변경
        await updateBillingCandidate((member as any).id, {
          status: "제외",
          memo: `${input.closureType} 처리: ${input.sourceSystemId}`,
        } as any);

        // 연동 로그 기록
        await createSyncLog({
          eventType: "CLOSURE",
          sourceId: input.sourceSystemId,
          targetId: String(closureId),
          status: "SUCCESS",
          message: `${input.closureType} 현황에 등록되었으며, ${excludeStartMonth}부터 부과 제외됩니다.`,
        });

        return {
          status: "success",
          message: `${input.closureType} 현황에 등록되었으며, ${excludeStartMonth}부터 부과 제외됩니다.`,
          closureId,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        await createSyncLog({
          eventType: "CLOSURE",
          sourceId: input.sourceSystemId,
          status: "FAIL",
          message,
        });
        throw error;
      }
    }),

  // 다음 달 부과 대상자 목록 조회
  listCandidates: publicProcedure
    .input(
      z.object({
        region: z.string().optional(),
        memberType: z.string().optional(),
        status: z.string().optional(),
        billingStartMonth: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const candidates = await getBillingCandidates({
        region: input.region,
        memberType: input.memberType,
        status: input.status,
        billingStartMonth: input.billingStartMonth,
      });
      return await candidates;
    }),

  // 부과 대상자 상세 조회
  getCandidate: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getBillingCandidateById(input.id);
    }),

  // 부과 대상자 상태 업데이트
  updateCandidate: publicProcedure
    .input(
      z.object({
        id: z.number(),
        billingStartMonth: z.string().optional(),
        status: z.enum(["대기", "부과예정", "부과반영완료", "확인필요", "보류", "제외"]).optional(),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await updateBillingCandidate(input.id, {
        billingStartMonth: input.billingStartMonth,
        status: input.status,
        memo: input.memo,
      });
      return { success: true };
    }),

  // 폐업 현황 목록 조회
  listClosures: publicProcedure
    .input(
      z.object({
        closureType: z.string().optional(),
        reflectStatus: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const closures = await getClosureEvents({
        closureType: input.closureType,
        reflectStatus: input.reflectStatus,
      });
      return await closures;
    }),

  // 연동 로그 조회
  listSyncLogs: publicProcedure
    .input(
      z.object({
        eventType: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const logs = await getSyncLogs({
        eventType: input.eventType,
        status: input.status,
      });
      return await logs;
    }),

  // 납부현황 조회
  listBillingRecords: publicProcedure
    .input(
      z.object({
        billingCandidateId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return await getBillingRecords(input.billingCandidateId);
    }),

  // 대시보드 통계
  getDashboardStats: publicProcedure.query(async () => {
    const candidates = await getBillingCandidates();
    const list = await candidates;

    const nextMonthCount = list.filter((c: any) => c.status === "대기").length;
    const thisMonthCount = list.filter((c: any) => c.status === "부과예정").length;
    const closurePendingCount = list.filter((c: any) => c.status === "제외").length;
    const unpaidCount = list.filter((c: any) => c.status === "확인필요").length;
    const confirmNeededCount = list.filter((c: any) => c.status === "확인필요").length;

    return {
      nextMonthCount,
      thisMonthCount,
      closurePendingCount,
      unpaidCount,
      confirmNeededCount,
    };
  }),

  // 회원관리 자료 불러오기 - 미리보기 (DB 쓰기 없음)
  previewImport: publicProcedure
    .input(z.object({ rows: z.array(importRowSchema) }))
    .mutation(async ({ input }) => {
      const items = await buildPreview(input.rows);
      return { items };
    }),

  // 회원관리 자료 불러오기 - 반영 (선택된 rowIndex만 처리)
  applyImport: publicProcedure
    .input(
      z.object({
        rows: z.array(importRowSchema),
        selectedIndexes: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      const preview = await buildPreview(input.rows);
      const selected = preview.filter((item) => input.selectedIndexes.includes(item.rowIndex));

      const results: { rowIndex: number; status: string; message: string }[] = [];

      for (const item of selected) {
        try {
          if (item.type === "REGISTER") {
            const row = item.raw as z.infer<typeof registerRowSchema>;

            if (item.duplicateId) {
              await updateBillingCandidate(item.duplicateId, {
                status: "확인필요",
                memo: `중복 데이터(불러오기): ${row.sourceSystemId}`,
              });
              await createSyncLog({
                eventType: "IMPORT",
                sourceId: row.sourceSystemId,
                targetId: String(item.duplicateId),
                status: "WARNING",
                message: "중복 데이터 - 확인필요 상태로 변경",
              });
              results.push({ rowIndex: item.rowIndex, status: "warning", message: "중복 - 확인필요 처리" });
            } else {
              const billingStartMonth = calculateBillingStartMonth(row.memberType, row.joinDate, row.certificateDate);
              const { billingType, status } = determineBillingType(row.memberType, row.joinDate, row.certificateDate);
              const result: any = await createBillingCandidate({
                sourceSystemId: row.sourceSystemId,
                managementNo: row.managementNo,
                region: row.region,
                vehicleNo: row.vehicleNo,
                name: row.name,
                rrn: row.rrn,
                mobile: row.mobile,
                vehicleType: row.vehicleType,
                businessNo: row.businessNo,
                company: row.company,
                joinDate: row.joinDate ? new Date(row.joinDate) : undefined,
                certificateDate: row.certificateDate ? new Date(row.certificateDate) : undefined,
                memo: row.memo,
                memberType: row.memberType,
                billingType,
                billingStartMonth: billingStartMonth || "",
                status,
              });
              const candidateId = result?.insertId || 0;
              await createSyncLog({
                eventType: "IMPORT",
                sourceId: row.sourceSystemId,
                targetId: String(candidateId),
                status: status === "확인필요" ? "WARNING" : "SUCCESS",
                message: status === "확인필요"
                  ? `필수 날짜 누락 (${row.memberType === "개인회원" ? "joinDate" : "certificateDate"})`
                  : `${billingType} 대상자 등록 (부과시작월: ${billingStartMonth})`,
              });
              results.push({ rowIndex: item.rowIndex, status: "success", message: `${billingType} 등록 완료` });
            }
          } else {
            // CLOSURE
            const row = item.raw as z.infer<typeof closureRowSchema>;
            const processDate = new Date(row.processDate);
            const nextMonthVal = processDate.getMonth() + 2;
            const nextYear = nextMonthVal > 12 ? processDate.getFullYear() + 1 : processDate.getFullYear();
            const nextMonth = nextMonthVal > 12 ? nextMonthVal - 12 : nextMonthVal;
            const excludeStartMonth = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;

            const closureResult: any = await createClosureEvent({
              sourceSystemId: row.sourceSystemId,
              closureType: row.closureType,
              managementNo: row.managementNo,
              region: row.region,
              vehicleNo: row.vehicleNo,
              name: row.name,
              receiptDate: row.receiptDate ? new Date(row.receiptDate) : undefined,
              processDate: processDate,
              excludeStartMonth,
              unpaidAmountAtClosure: 0,
              reflectStatus: "확인필요",
            });
            const closureId = closureResult?.insertId || 0;

            if (item.matchedCandidateId) {
              await updateBillingCandidate(item.matchedCandidateId, {
                status: "제외",
                memo: `${row.closureType} 처리(불러오기): ${row.sourceSystemId}`,
              } as any);
            }

            await createSyncLog({
              eventType: "IMPORT",
              sourceId: row.sourceSystemId,
              targetId: String(closureId),
              status: "SUCCESS",
              message: `${row.closureType} 등록, ${excludeStartMonth}부터 부과 제외`,
            });
            results.push({ rowIndex: item.rowIndex, status: "success", message: `${row.closureType} 등록 완료` });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "오류";
          await createSyncLog({
            eventType: "IMPORT",
            sourceId: (item.raw as any).sourceSystemId,
            status: "FAIL",
            message,
          });
          results.push({ rowIndex: item.rowIndex, status: "fail", message });
        }
      }

      const successCount = results.filter((r) => r.status === "success").length;
      const warningCount = results.filter((r) => r.status === "warning").length;
      const failCount = results.filter((r) => r.status === "fail").length;

      return { results, successCount, warningCount, failCount };
    }),

  // 수동 부과 배치 실행
  runManualBillingBatch: publicProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 형식이어야 합니다"),
      })
    )
    .mutation(async ({ input }) => {
      const { runManualBillingBatch } = await import("../scheduler/billingBatch");
      return await runManualBillingBatch(input.month);
    }),
});

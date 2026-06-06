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
function calculateBillingStartMonth(registrationDate: string | Date, certificateDate?: string | Date): string {
  const date = new Date(registrationDate || certificateDate || new Date());
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
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
function determineBillingType(memberType: string, joinDate?: string, certificateDate?: string): string {
  if (memberType === "개인회원" && joinDate) {
    return "협회비";
  }
  if (memberType === "택배회원" && certificateDate) {
    return "관리비";
  }
  return "협회비"; // 기본값
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
          input.registrationDate,
          input.certificateDate
        );

        // 부과항목 결정
        const billingType = determineBillingType(
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
          billingStartMonth,
          status: "대기",
        });

        const candidateId = result?.insertId || 1;

        // 연동 로그 기록
        await createSyncLog({
          eventType: "REGISTER",
          sourceId: input.sourceSystemId,
          targetId: String(candidateId),
          status: "SUCCESS",
          message: "다음 달 부과 대상자로 등록되었습니다.",
        });

        return {
          status: "success",
          message: "다음 달 부과 대상자로 등록되었습니다.",
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
  listCandidates: protectedProcedure
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
  getCandidate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getBillingCandidateById(input.id);
    }),

  // 부과 대상자 상태 업데이트
  updateCandidate: protectedProcedure
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
  listClosures: protectedProcedure
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
  listSyncLogs: protectedProcedure
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
  listBillingRecords: protectedProcedure
    .input(
      z.object({
        billingCandidateId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return await getBillingRecords(input.billingCandidateId);
    }),

  // 대시보드 통계
  getDashboardStats: protectedProcedure.query(async () => {
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
});

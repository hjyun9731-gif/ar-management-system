import { getBillingCandidates, createBillingRecord, createSyncLog } from "../db";

const ASSOCIATION_FEE = 10000; // 협회비
const MANAGEMENT_FEE = 5000; // 관리비

/**
 * 월별 자동 부과 배치 스케줄러
 * 매월 1일 자동 실행 (부과시작월이 현재 월인 회원을 대상)
 */
export async function runMonthlyBillingBatch() {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    console.log(`[Billing Batch] Starting monthly billing batch for ${currentMonth}`);

    // 부과시작월이 현재 월인 회원 조회
    const candidates = await getBillingCandidates({
      billingStartMonth: currentMonth,
    });
    const list = await candidates;

    // 제외 상태가 아닌 회원만 필터링
    const activeMembers = list.filter((c: any) => c.status !== "제외");

    let successCount = 0;
    let failCount = 0;

    for (const member of activeMembers) {
      try {
        // 부과 금액 결정
        const amount = member.billingType === "관리비" ? MANAGEMENT_FEE : ASSOCIATION_FEE;

        // 납부현황 기록 생성
        await createBillingRecord({
          billingCandidateId: member.id,
          billingMonth: currentMonth,
          amount,
          isPaid: 0,
          paidDate: undefined,
          paidAmount: 0,
        });

        successCount++;

        // 연동 로그 기록
        await createSyncLog({
          eventType: "BILLING",
          sourceId: `batch-${currentMonth}`,
          targetId: String(member.id),
          status: "SUCCESS",
          message: `${currentMonth} 부과 반영 완료 (${member.billingType}: ${amount.toLocaleString()}원)`,
        });
      } catch (error) {
        failCount++;
        const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";

        await createSyncLog({
          eventType: "BILLING",
          sourceId: `batch-${currentMonth}`,
          targetId: String(member.id),
          status: "FAIL",
          message: `${currentMonth} 부과 반영 실패: ${errorMsg}`,
        });

        console.error(`[Billing Batch] Failed to create billing record for member ${member.id}:`, error);
      }
    }

    console.log(
      `[Billing Batch] Completed. Success: ${successCount}, Failed: ${failCount}, Total: ${activeMembers.length}`
    );

    return {
      month: currentMonth,
      totalMembers: activeMembers.length,
      successCount,
      failCount,
    };
  } catch (error) {
    console.error("[Billing Batch] Fatal error:", error);
    throw error;
  }
}

/**
 * 특정 월의 부과 배치 수동 실행
 */
export async function runManualBillingBatch(month: string) {
  try {
    console.log(`[Billing Batch] Starting manual billing batch for ${month}`);

    const candidates = await getBillingCandidates({
      billingStartMonth: month,
    });
    const list = await candidates;

    const activeMembers = list.filter((c: any) => c.status !== "제외");

    let successCount = 0;
    let failCount = 0;

    for (const member of activeMembers) {
      try {
        const amount = member.billingType === "관리비" ? MANAGEMENT_FEE : ASSOCIATION_FEE;

        await createBillingRecord({
          billingCandidateId: member.id,
          billingMonth: month,
          amount,
          isPaid: 0,
          paidDate: undefined,
          paidAmount: 0,
        });

        successCount++;

        await createSyncLog({
          eventType: "BILLING_MANUAL",
          sourceId: `manual-${month}`,
          targetId: String(member.id),
          status: "SUCCESS",
          message: `${month} 부과 반영 완료 (수동 실행, ${member.billingType}: ${amount.toLocaleString()}원)`,
        });
      } catch (error) {
        failCount++;
        const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류";

        await createSyncLog({
          eventType: "BILLING_MANUAL",
          sourceId: `manual-${month}`,
          targetId: String(member.id),
          status: "FAIL",
          message: `${month} 부과 반영 실패: ${errorMsg}`,
        });
      }
    }

    console.log(`[Billing Batch] Manual batch completed. Success: ${successCount}, Failed: ${failCount}`);

    return {
      month,
      totalMembers: activeMembers.length,
      successCount,
      failCount,
    };
  } catch (error) {
    console.error("[Billing Batch] Manual batch error:", error);
    throw error;
  }
}

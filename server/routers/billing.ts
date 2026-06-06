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
function nextBillingMonth(base?: string | Date): string | null {
  if (!base) return null;
  const baseDate = new Date(base);
  if (Number.isNaN(baseDate.getTime())) return null;
  const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
}

// 레거시 연동용: 단일 부과항목 계산
// 실제 불러오기/미리보기는 buildRegisterPreviewItems에서 업무 기준에 따라 1개 부과항목만 생성한다.
function calculateBillingStartMonth(
  memberType: string,
  joinDate?: string | Date,
  certificateDate?: string | Date,
  approvalDate?: string | Date,
  billingType?: string
): string | null {
  if (billingType === "협회비") return nextBillingMonth(joinDate);
  if (billingType === "관리비") return nextBillingMonth(certificateDate);

  if (joinDate) return nextBillingMonth(joinDate);
  if (memberType === "택배회원" && approvalDate && certificateDate) return nextBillingMonth(certificateDate);
  return null;
}

// 중복 체크 함수
async function checkDuplicate(data: {
  rrn?: string;
  vehicleNo: string;
  name: string;
  billingType?: string;
}): Promise<number | null> {
  const candidates = await getBillingCandidates();
  const list = await candidates;

  const sameBillingType = (c: any) => !data.billingType || !c.billingType || c.billingType === data.billingType;

  // 1순위: 주민등록번호 + 부과항목
  if (data.rrn) {
    const found = list.find((c: any) => c.rrn === data.rrn && sameBillingType(c));
    if (found) return found.id;
  }

  // 2순위: 차량번호 + 부과항목
  const vehicleMatch = list.find((c: any) => c.vehicleNo === data.vehicleNo && sameBillingType(c));
  if (vehicleMatch) return vehicleMatch.id;

  // 3순위: 성명 + 차량번호 뒤 4자리 + 부과항목
  const vehicleLast4 = data.vehicleNo.slice(-4);
  const nameVehicleMatch = list.find(
    (c: any) => c.name === data.name && c.vehicleNo.slice(-4) === vehicleLast4 && sameBillingType(c)
  );
  if (nameVehicleMatch) return nameVehicleMatch.id;

  return null;
}

// 부과항목 결정 함수 (레거시 단일 등록용)
// 일반/개인/택배 모두 가입일자가 있으면 협회비를 우선한다.
// 택배회원도 가입일자가 있으면 관리비가 아니라 협회비로 본다.
// 택배회원 중 가입일자가 없고 인가일자+자격증명발급일자가 모두 있을 때만 관리비 대상이다.
function determineBillingType(
  memberType: string,
  joinDate?: string | Date,
  certificateDate?: string | Date,
  approvalDate?: string | Date
): { billingType: string; status: string } {
  if (joinDate) return { billingType: "협회비", status: "대기" };
  if (memberType === "택배회원" && approvalDate && certificateDate) return { billingType: "관리비", status: "대기" };
  return { billingType: "확인필요", status: "확인필요" };
}

function hasValue(value?: string | Date): boolean {
  if (!value) return false;
  return String(value).trim().length > 0;
}

function findDuplicateForBillingType(list: any[], row: { rrn?: string; vehicleNo: string; name: string }, billingType: string): number | undefined {
  const sameBillingType = (c: any) => !c.billingType || c.billingType === billingType;
  if (row.rrn) {
    const found = list.find((c: any) => c.rrn === row.rrn && sameBillingType(c));
    if (found) return found.id;
  }
  const vehicleMatch = list.find((c: any) => c.vehicleNo === row.vehicleNo && sameBillingType(c));
  if (vehicleMatch) return vehicleMatch.id;
  const last4 = row.vehicleNo.slice(-4);
  const nameVehicleMatch = list.find((c: any) => c.name === row.name && c.vehicleNo.slice(-4) === last4 && sameBillingType(c));
  return nameVehicleMatch?.id;
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
  memberType: z.enum(["개인회원", "택배회원", "일반회원"]).transform((v) => v === "일반회원" ? "개인회원" : v),
  joinDate: z.string().optional(),
  approvalDate: z.string().optional(),
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
  billingSource?: "가입일자" | "인가일자+자격증명" | "확인필요";
  duplicateId?: number;
  reason?: string;
  raw: z.infer<typeof registerRowSchema>;
}

interface PreviewClosureItem {
  rowIndex: number;
  type: "CLOSURE";
  category: "폐업양도이관" | "확인필요";
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

function makeRegisterPreviewItem(params: {
  row: z.infer<typeof registerRowSchema>;
  rowIndex: number;
  list: any[];
  billingType: "협회비" | "관리비" | "확인필요";
  billingStartMonth: string;
  status: string;
  billingSource: "가입일자" | "인가일자+자격증명" | "확인필요";
  reason?: string;
}): PreviewRegisterItem {
  const duplicateId = params.billingType === "확인필요"
    ? undefined
    : findDuplicateForBillingType(params.list, params.row, params.billingType);

  let category: PreviewRegisterItem["category"];
  let reason = params.reason;

  if (duplicateId) {
    category = "중복의심";
    reason = `기존 ID ${duplicateId}와 차량번호/주민번호/부과항목 중복`;
  } else if (params.status === "확인필요") {
    category = "날짜누락";
  } else {
    category = "신규";
  }

  return {
    rowIndex: params.rowIndex,
    type: "REGISTER",
    category,
    sourceSystemId: params.billingType === "확인필요" ? params.row.sourceSystemId : `${params.row.sourceSystemId}-${params.billingType}`,
    vehicleNo: params.row.vehicleNo,
    name: params.row.name,
    memberType: params.row.memberType,
    billingType: params.billingType,
    billingStartMonth: params.billingStartMonth,
    status: params.status,
    billingSource: params.billingSource,
    duplicateId,
    reason,
    raw: params.row,
  };
}

function buildRegisterPreviewItems(row: z.infer<typeof registerRowSchema>, list: any[], nextIndex: () => number): PreviewRegisterItem[] {
  const items: PreviewRegisterItem[] = [];

  // 1) 일반/개인/택배 모두 가입일자가 있으면 협회비 대상이다.
  //    택배회원도 가입일자가 있으면 관리비가 아니라 협회비로만 본다.
  if (hasValue(row.joinDate)) {
    items.push(makeRegisterPreviewItem({
      row,
      rowIndex: nextIndex(),
      list,
      billingType: "협회비",
      billingStartMonth: nextBillingMonth(row.joinDate) || "",
      status: "대기",
      billingSource: "가입일자",
      reason: row.memberType === "택배회원" ? "택배회원 가입일자 기준 협회비" : "가입일자 기준 협회비",
    }));
    return items;
  }

  // 2) 택배회원은 가입일자가 없고 인가일자 + 자격증명발급일자가 모두 있을 때만 관리비 대상이다.
  if (row.memberType === "택배회원") {
    const hasApproval = hasValue(row.approvalDate);
    const hasCertificate = hasValue(row.certificateDate);

    if (hasApproval && hasCertificate) {
      items.push(makeRegisterPreviewItem({
        row,
        rowIndex: nextIndex(),
        list,
        billingType: "관리비",
        billingStartMonth: nextBillingMonth(row.certificateDate) || "",
        status: "대기",
        billingSource: "인가일자+자격증명",
        reason: "가입일자 없음 / 인가일자 및 자격증명발급일자 기준 관리비",
      }));
      return items;
    }

    if (hasApproval || hasCertificate) {
      const missing = !hasApproval ? "인가일자 누락" : "자격증명발급일자 누락";
      items.push(makeRegisterPreviewItem({
        row,
        rowIndex: nextIndex(),
        list,
        billingType: "확인필요",
        billingStartMonth: "",
        status: "확인필요",
        billingSource: "확인필요",
        reason: `가입일자 없음 / 택배 관리비 ${missing}`,
      }));
      return items;
    }
  }

  // 3) 아무 부과항목도 만들 수 없으면 확인필요
  const reason = row.memberType === "택배회원"
    ? "가입일자 없음 / 인가일자·자격증명발급일자 부족"
    : "가입일자 누락";
  items.push(makeRegisterPreviewItem({
    row,
    rowIndex: nextIndex(),
    list,
    billingType: "확인필요",
    billingStartMonth: "",
    status: "확인필요",
    billingSource: "확인필요",
    reason,
  }));

  return items;
}

async function buildPreview(rows: ImportRow[]): Promise<PreviewItem[]> {
  const allCandidates = await getBillingCandidates();
  const list: any[] = await allCandidates;

  const items: PreviewItem[] = [];
  let previewIndex = 0;
  const nextIndex = () => previewIndex++;

  for (const row of rows) {
    if (row.type === "REGISTER") {
      items.push(...buildRegisterPreviewItems(row, list, nextIndex));
    } else {
      // CLOSURE
      const processDate = row.processDate ? new Date(row.processDate) : null;
      const hasValidProcessDate = !!processDate && !Number.isNaN(processDate.getTime());
      let excludeStartMonth = "";
      if (hasValidProcessDate) {
        const nextMonthVal = processDate!.getMonth() + 2;
        const nextYear = nextMonthVal > 12 ? processDate!.getFullYear() + 1 : processDate!.getFullYear();
        const nextMonth = nextMonthVal > 12 ? nextMonthVal - 12 : nextMonthVal;
        excludeStartMonth = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
      }

      const matched = list.find(
        (c: any) => c.vehicleNo === row.vehicleNo || c.managementNo === row.managementNo
      );

      items.push({
        rowIndex: nextIndex(),
        type: "CLOSURE",
        category: hasValidProcessDate ? "폐업양도이관" : "확인필요",
        sourceSystemId: row.sourceSystemId,
        vehicleNo: row.vehicleNo,
        name: row.name,
        closureType: row.closureType,
        excludeStartMonth,
        matchedCandidateId: matched?.id,
        reason: !hasValidProcessDate
          ? "처리일자 누락 또는 형식 오류"
          : matched ? undefined : "부과 대상자 미등록 (신규 등록 필요)",
        raw: row,
      });
    }
  }

  return items;
}


// ---- Direct read-only fetch from member-management system ----
type MemberSystemAuth = { authorization?: string };

function cleanBaseUrl(url?: string): string {
  return (url || "").trim().replace(/\/+$/, "");
}

async function getMemberSystemAuth(baseUrl: string): Promise<MemberSystemAuth> {
  const token = process.env.MEMBER_SYSTEM_API_TOKEN?.trim();
  if (token) return { authorization: `Bearer ${token}` };

  const username = process.env.MEMBER_SYSTEM_USERNAME?.trim();
  const password = process.env.MEMBER_SYSTEM_PASSWORD?.trim();
  if (!username || !password) return {};

  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `회원관리시스템 로그인 실패 (${res.status}) ${text}`.trim(),
    });
  }

  const data: any = await res.json();
  if (!data?.access_token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "회원관리시스템 로그인 응답에 access_token이 없습니다." });
  }

  return { authorization: `${data.token_type || "bearer"} ${data.access_token}` };
}

async function memberSystemGet(baseUrl: string, path: string, auth: MemberSystemAuth): Promise<any> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth.authorization) headers.Authorization = auth.authorization;

  const res = await fetch(`${baseUrl}${path}`, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TRPCError({
      code: res.status === 401 || res.status === 403 ? "UNAUTHORIZED" : "BAD_REQUEST",
      message: `회원관리시스템 조회 실패: GET ${path} (${res.status}) ${text}`.trim(),
    });
  }
  return await res.json();
}

async function fetchAllPagedFromMemberSystem(baseUrl: string, path: string, auth: MemberSystemAuth, maxPages = 200): Promise<any[]> {
  const items: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const data = await memberSystemGet(baseUrl, `${path}${separator}page=${page}&limit=200`, auth);
    const pageItems = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    items.push(...pageItems);

    if (Array.isArray(data)) break;
    const pages = Number(data?.pages || 1);
    if (page >= pages || pageItems.length === 0) break;
  }
  return items;
}

function toDateString(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  // API already returns YYYY-MM-DD for most fields. Keep the date part only.
  const m = text.match(/\d{4}[-.]\d{1,2}[-.]\d{1,2}/);
  if (!m) return text;
  return m[0].replace(/\./g, "-").replace(/-(\d)(?=-|$)/g, "-0$1");
}

function mapMemberType(category: any, vehicleNo?: string): "개인회원" | "택배회원" {
  const value = String(category || "").trim();
  if (value.includes("택배") || String(vehicleNo || "").includes("배")) return "택배회원";
  return "개인회원";
}

function normalizeClosureTypeForImport(value: any): "폐업" | "양도" | "이관" {
  const text = String(value || "폐업").trim();
  if (text.includes("양")) return "양도";
  if (text.includes("이") || text.includes("타도")) return "이관";
  return "폐업";
}

function mapMemberSystemMemberToImportRow(member: any): ImportRow {
  const vehicleNo = member.vehicle_number || member.vehicleNo || "";
  return {
    type: "REGISTER",
    sourceSystemId: `MEMBER-${member.id ?? member.sourceSystemId ?? vehicleNo}`,
    managementNo: member.management_number || member.managementNo || undefined,
    region: member.region || undefined,
    vehicleNo,
    name: member.name || "",
    rrn: member.resident_number || member.rrn || undefined,
    mobile: member.mobile || undefined,
    memberType: mapMemberType(member.category, vehicleNo),
    joinDate: toDateString(member.membership_date || member.joinDate),
    approvalDate: toDateString(member.approval_date || member.approvalDate),
    certificateDate: toDateString(member.certificate_issue_date || member.certificateDate),
    vehicleType: member.vehicle_type || undefined,
    businessNo: member.business_number || undefined,
    company: member.affiliated_company || member.company_name || undefined,
    memo: member.memo || undefined,
  };
}

function mapMemberSystemClosureToImportRow(closure: any): ImportRow {
  const vehicleNo = closure.vehicle_number || closure.vehicleNo || "";
  return {
    type: "CLOSURE",
    sourceSystemId: `CLOSURE-${closure.id ?? closure.sourceSystemId ?? vehicleNo}`,
    closureType: normalizeClosureTypeForImport(closure.closure_type || closure.closureType),
    managementNo: closure.management_number || closure.managementNo || "",
    region: closure.region || undefined,
    vehicleNo,
    name: closure.name || "",
    processDate: toDateString(closure.closure_date || closure.processDate || closure.approval_date || closure.created_at) || "",
    receiptDate: toDateString(closure.receipt_date || closure.receiptDate),
  };
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
          input.certificateDate,
          input.approvalDate
        );

        // 부과항목 결정
        const { billingType, status: determinedStatus } = determineBillingType(
          input.memberType,
          input.joinDate,
          input.certificateDate,
          input.approvalDate
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

  // 회원관리시스템 직접 불러오기 - 읽기 전용 미리보기 (DB 쓰기 없음)
  fetchFromMemberSystemPreview: publicProcedure
    .input(
      z.object({
        includeMembers: z.boolean().optional().default(true),
        includeClosures: z.boolean().optional().default(false),
      }).optional()
    )
    .mutation(async ({ input }) => {
      const baseUrl = cleanBaseUrl(process.env.MEMBER_SYSTEM_BASE_URL);
      if (!baseUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "MEMBER_SYSTEM_BASE_URL 환경변수가 설정되지 않았습니다.",
        });
      }

      const auth = await getMemberSystemAuth(baseUrl);
      const rows: ImportRow[] = [];
      let membersCount = 0;
      let closuresCount = 0;

      if (input?.includeMembers !== false) {
        const members = await fetchAllPagedFromMemberSystem(baseUrl, "/api/members?status=all", auth);
        membersCount = members.length;
        rows.push(...members.map(mapMemberSystemMemberToImportRow));
      }

      if (input?.includeClosures !== false) {
        const closures = await fetchAllPagedFromMemberSystem(baseUrl, "/api/closures", auth);
        closuresCount = closures.length;
        rows.push(...closures.map(mapMemberSystemClosureToImportRow));
      }

      const items = await buildPreview(rows);
      return {
        rows,
        items,
        source: {
          baseUrl,
          membersCount,
          closuresCount,
          totalRows: rows.length,
          authMode: process.env.MEMBER_SYSTEM_API_TOKEN ? "token" : process.env.MEMBER_SYSTEM_USERNAME ? "password" : "none",
        },
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
                memo: `중복 데이터(불러오기): ${item.sourceSystemId}`,
              });
              await createSyncLog({
                eventType: "IMPORT",
                sourceId: item.sourceSystemId,
                targetId: String(item.duplicateId),
                status: "WARNING",
                message: "중복 데이터 - 확인필요 상태로 변경",
              });
              results.push({ rowIndex: item.rowIndex, status: "warning", message: "중복 - 확인필요 처리" });
            } else {
              const billingType = item.billingType || "확인필요";
              const status = item.status || "확인필요";
              const billingStartMonth = item.billingStartMonth || "";
              const result: any = await createBillingCandidate({
                sourceSystemId: item.sourceSystemId,
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
                memo: [row.memo, item.billingSource ? `부과기준: ${item.billingSource}` : undefined, item.reason].filter(Boolean).join(" / ") || undefined,
                memberType: row.memberType,
                billingType,
                billingStartMonth,
                status,
              });
              const candidateId = result?.insertId || 0;
              await createSyncLog({
                eventType: "IMPORT",
                sourceId: item.sourceSystemId,
                targetId: String(candidateId),
                status: status === "확인필요" ? "WARNING" : "SUCCESS",
                message: status === "확인필요"
                  ? (item.reason || "필수 날짜 누락")
                  : `${billingType} 대상자 등록 (부과시작월: ${billingStartMonth}, 기준: ${item.billingSource || "-"})`,
              });
              results.push({ rowIndex: item.rowIndex, status: "success", message: `${billingType} 등록 완료` });
            }
          } else {
            // CLOSURE
            const row = item.raw as z.infer<typeof closureRowSchema>;
            const processDate = row.processDate ? new Date(row.processDate) : null;
            if (!processDate || Number.isNaN(processDate.getTime())) {
              await createSyncLog({
                eventType: "IMPORT",
                sourceId: row.sourceSystemId,
                status: "WARNING",
                message: "폐업/양도/이관 처리일자 누락으로 반영 보류",
              });
              results.push({ rowIndex: item.rowIndex, status: "warning", message: "처리일자 누락 - 반영 보류" });
              continue;
            }
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

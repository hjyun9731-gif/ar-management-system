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
  getDb,
} from "../db";
import { TRPCError } from "@trpc/server";
import { eq, like } from "drizzle-orm";
import { billingCandidates } from "../../drizzle/schema";

// 회원관리시스템 날짜 포맷 정규화
// 지원 예: 18.10.24 -> 2018-10-24, 2018.10.24 -> 2018-10-24, 18-10-24 -> 2018-10-24
function normalizeDateString(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const text = String(value).trim();
  if (!text || text === "-" || text.toLowerCase() === "x" || text === "미가입") return undefined;

  const match = text.match(/(\d{2,4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!match) return undefined;

  let year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  // 회원관리시스템의 18.10.24 같은 값은 2018-10-24로 해석한다.
  if (year < 100) year += year >= 70 ? 1900 : 2000;

  const lastDay = new Date(year, month, 0).getDate();
  if (day > lastDay) return undefined;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 부과시작일 자동 계산 함수
// 기준일의 다음 달 같은 날짜부터 부과한다.
// 예: 2026-05-15 -> 2026-06-15, 18.10.24 -> 2018-11-24
// 말일 보정: 2026-01-31 -> 2026-02-28
function nextBillingMonth(base?: string | Date): string | null {
  const normalized = normalizeDateString(base);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const sourceMonthIndex = month - 1;
  const targetYear = sourceMonthIndex === 11 ? year + 1 : year;
  const targetMonthIndex = sourceMonthIndex === 11 ? 0 : sourceMonthIndex + 1;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

// Drizzle MySQL date column은 Date 객체가 아니라 YYYY-MM-DD 문자열로 넣어야 안전하다.
// Date 객체가 들어가면 MySQL에 "Thu Nov..." 형태로 전달되어 insert가 실패할 수 있다.


function getMonthKey(value?: string | null): string | null {
  if (!value) return null;
  const normalized = normalizeDateString(value) || String(value).trim();
  const match = normalized.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getNextMonthKey(): string {
  const now = new Date();
  const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const month = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
  return year + "-" + String(month).padStart(2, "0");
}

function isCurrentOrNextBillingTarget(value?: string | null): boolean {
  const monthKey = getMonthKey(value);
  if (!monthKey) return false;
  return monthKey === getCurrentMonthKey() || monthKey === getNextMonthKey();
}


function getBillingTargetCategoryV33(value?: string | null, status?: string | null): "기존부과중" | "이번달부과대상" | "다음달부과대상" | "확인필요" {
  if (status === "확인필요") return "확인필요";
  const key = getMonthKey(value);
  if (!key) return "기존부과중";
  if (key === getCurrentMonthKey()) return "이번달부과대상";
  if (key === getNextMonthKey()) return "다음달부과대상";
  return "기존부과중";
}

function getBillingStatusV33(value?: string | null, status?: string | null): string {
  if (status === "확인필요") return "확인필요";
  const category = getBillingTargetCategoryV33(value, status);
  if (category === "이번달부과대상") return "부과예정";
  if (category === "다음달부과대상") return "대기";
  return "기존부과중";
}

function determinePreviewStatus(billingStartDate?: string): "대기" | "부과예정" {
  const monthKey = getMonthKey(billingStartDate);
  if (!monthKey) return "대기";
  // 이번 달 부과대상 판단: 예) 2026-05-dd 인가 → 2026-06-dd 부과시작 → 6월 부과예정
  return monthKey === getCurrentMonthKey() ? "부과예정" : "대기";
}

function toDbDate(value: any): string | undefined {
  return normalizeDateString(value) || undefined;
}
// DB 저장용 휴대폰번호 정리
// 회원관리시스템 연락처에 여러 번호/대리번호가 들어올 수 있으므로
// mobile에는 첫 번째 휴대폰번호만 저장하고 원본은 memo에 보존한다.

// v32: 부과대상 카테고리/상태 판단 helper
function __billingImportMonthKey(value: any): string | null {
  const m = String(value || '').match(/^(\d{4})-(\d{2})/);
  return m ? m[1] + '-' + m[2] : null;
}

function __billingImportCurrentMonthKey(): string {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function __billingImportNextMonthKey(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0');
}

function __billingImportCategory(item: any): string {
  if (!item || item.status === '확인필요' || item.billingType === '확인필요') return '확인필요';
  if (item.category === '중복 의심' || item.category === '중복의심') return '중복의심';
  if (item.hasArrears || item.hasUnpaid || item.arrearsAmount > 0 || item.unpaidAmount > 0) return '미수금있음';
  const key = __billingImportMonthKey(item.billingStartMonth || item.billingStartDate || item.startDate);
  if (!key) return '기존부과중';
  if (key === __billingImportCurrentMonthKey()) return '이번달부과대상';
  if (key === __billingImportNextMonthKey()) return '다음달부과대상';
  return '기존부과중';
}

function __billingImportStatus(item: any): string {
  const category = __billingImportCategory(item);
  if (category === '확인필요' || category === '중복의심') return '확인필요';
  if (category === '이번달부과대상') return '부과예정';
  if (category === '다음달부과대상') return '대기';
  return '기존부과중';
}

function normalizeMobileForDb(value: any): { mobile?: string; original?: string } {
  const original = String(value ?? "").trim();
  if (!original) return {};
  const match = original.match(/01[016789][\s-]?\d{3,4}[\s-]?\d{4}/);
  const raw = match ? match[0] : original;
  const digits = raw.replace(/\D/g, "");
  let mobile = raw.trim();
  if (digits.length === 10) {
    mobile = digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
  } else if (digits.length === 11) {
    mobile = digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
  }
  return { mobile: mobile.slice(0, 30), original };
}

function appendOriginalMobileMemo(memo: any, originalMobile?: string, savedMobile?: string): string | undefined {
  const base = String(memo ?? "").trim();
  const original = String(originalMobile ?? "").trim();
  const saved = String(savedMobile ?? "").trim();
  if (!original || original === saved) return base || undefined;
  const mobileMemo = "원본연락처: " + original;
  if (base.includes(mobileMemo)) return base;
  return [base, mobileMemo].filter(Boolean).join(" / ");
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
  if (joinDate) return { billingType: "협회비", status: __billingImportStatus(item) };
  if (memberType === "택배회원" && approvalDate && certificateDate) return { billingType: "관리비", status: __billingImportStatus(item) };
  return { billingType: "확인필요", status: "확인필요" };
}

function hasValue(value?: string | Date): boolean {
  if (!value) return false;
  return String(value).trim().length > 0;
}

// 회원관리시스템의 오래된 가입자는 가입일자 칸에 o/O/ㅇ/○ 같은 표시만 있고
// 실제 날짜가 없는 경우가 있다. 이 값은 날짜가 아니라 "가입 표시"로만 본다.
function isJoinMarker(value: any): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  return ["o", "0", "ㅇ", "○", "●", "가입"].includes(text);
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
  joinStatus: z.string().optional(),
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
  category: "기존부과중" | "이번달부과대상" | "다음달부과대상" | "부과대상" | "중복의심" | "날짜누락" | "확인필요" | "미수금있음";
  sourceSystemId: string;
  vehicleNo: string;
  name: string;
  memberType: string;
  billingType: string;
  billingStartMonth: string;
  status: string;
  billingSource?: "가입일자" | "인가일자" | "인가일자+자격증명" | "확인필요";
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
type ImportMode = "generalFee" | "deliveryManagementFee";

function makeRegisterPreviewItem(params: {
  row: z.infer<typeof registerRowSchema>;
  rowIndex: number;
  list: any[];
  billingType: "협회비" | "관리비" | "확인필요";
  billingStartMonth: string;
  status: string;
  billingSource: "가입일자" | "인가일자" | "인가일자+자격증명" | "확인필요";
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
    category = params.reason?.includes("인가일자") ? "확인필요" : "날짜누락";
  } else {
    category = getBillingTargetCategoryV33(params.billingStartMonth, params.status) as PreviewRegisterItem["category"];
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

function buildRegisterPreviewItems(
  row: z.infer<typeof registerRowSchema>,
  list: any[],
  nextIndex: () => number,
  mode: ImportMode = "generalFee"
): PreviewRegisterItem[] {
  const isBaeVehicle = String(row.vehicleNo || "").includes("배");
  const joinStatus = String(row.joinStatus || "").trim();
  const isNonJoined = joinStatus.includes("미가입") || joinStatus.toLowerCase() === "x";
  const isJoined = !isNonJoined && (joinStatus === "가입" || joinStatus.includes("가입") || !!row.joinDate);

  if (mode === "deliveryManagementFee") {
    // 2단계 규칙:
    // 택배/배번호 차량만 본다.
    // 협회 가입일자가 있거나 가입 상태면 협회비 대상이므로 관리비 추출에서 제외한다.
    // 가입일자 없음 + 인가일자 + 자격증명발급일자가 있으면 관리비 대상이다.
    // 부과시작일은 자격증명발급일자 다음 달 같은 날짜다.
    if (!isBaeVehicle) return [];
    if (isJoined) return [];

    const hasApprovalDate = !!normalizeDateString(row.approvalDate);
    const hasCertificateDate = !!normalizeDateString(row.certificateDate);
    // 2단계 관리비 부과시작일 판단은 인가일자를 기준으로 한다.
    // 예: 2026-05-dd 인가 받은 택배 미가입자 → 2026-06-dd부터 관리비 부과대상.
    // 자격증명발급일자는 관리비 편입 조건 확인용으로 함께 요구한다.
    const billingStartDate = hasApprovalDate ? (nextBillingMonth(row.approvalDate) || "") : "";

    if (hasApprovalDate && hasCertificateDate) {
      return [makeRegisterPreviewItem({
        row,
        rowIndex: nextIndex(),
        list,
        billingType: "관리비",
        billingStartMonth: billingStartDate,
        status: determinePreviewStatus(billingStartDate),
        billingSource: "인가일자",
        reason: getMonthKey(billingStartDate) === getCurrentMonthKey()
          ? "택배 미가입자 인가일자 기준 이번 달 관리비 부과대상"
          : "택배 미가입자 인가일자 기준 관리비",
      })];
    }

    const missingReason = !hasApprovalDate && !hasCertificateDate
      ? "택배 관리비 인가일자 및 자격증명발급일자 누락"
      : !hasApprovalDate
        ? "택배 관리비 인가일자 누락"
        : "택배 관리비 자격증명발급일자 누락";

    return [makeRegisterPreviewItem({
      row,
      rowIndex: nextIndex(),
      list,
      billingType: "확인필요",
      billingStartMonth: "",
      status: "확인필요",
      billingSource: "확인필요",
      reason: missingReason,
    })];
  }

  // 1단계 확정 규칙:
  // 일반 가입자(배번호 제외)만 협회비 부과대상으로 본다.
  // 가입일자가 정상 파싱되면 가입일자 다음 달 같은 날짜를 부과시작일로 쓴다.
  // 오래된 가입자처럼 가입일자 칸이 o/○ 등 표시뿐이면 인가일자를 대신 본다.
  // 인가일자도 없으면 부과시작일은 비워두되, 확인필요가 아니라 협회비 부과대상으로 유지한다.
  // 배번호/택배/관리비 대상은 이번 1단계에서 완전히 제외한다.
  if (isBaeVehicle) return [];
  if (isNonJoined) return [];
  if (!isJoined && !row.joinDate && !row.approvalDate) return [];

  const joinBasedStartDate = nextBillingMonth(row.joinDate);
  const approvalBasedStartDate = nextBillingMonth(row.approvalDate);
  const billingStartDate = joinBasedStartDate || approvalBasedStartDate || "";
  const basis = joinBasedStartDate ? "가입일자" : approvalBasedStartDate ? "인가일자" : "가입표시";

  return [makeRegisterPreviewItem({
    row,
    rowIndex: nextIndex(),
    list,
    billingType: "협회비",
    billingStartMonth: billingStartDate,
    status: determinePreviewStatus(billingStartDate),
    // 기존 회원 부과대상 추출이므로 부과대상 판단이 아니라 실제 기준일을 남긴다.
    // 가입일자 파싱 가능 -> 가입일자 기준, 가입일자 O/공란 등 오래된 가입자 -> 인가일자 기준, 둘 다 없으면 부과시작일 없이 협회비 대상.
    billingSource: basis === "인가일자" ? "인가일자" : "가입일자",
    reason: basis === "가입일자"
      ? (isCurrentOrNextBillingTarget(billingStartDate) ? "일반 가입자(배번호 제외) 가입일자 기준 협회비" : "기존 부과 중으로 판단: 가입일자 기준 협회비")
      : basis === "인가일자"
        ? "일반 가입자(배번호 제외) 가입일자 없음 / 인가일자 기준 협회비"
        : "일반 가입자(배번호 제외) 가입일자·인가일자 없음 / 협회비 부과대상",
  })];
}

async function buildPreview(rows: ImportRow[], mode: ImportMode = "generalFee"): Promise<PreviewItem[]> {
  const allCandidates = await getBillingCandidates();
  const list: any[] = await allCandidates;

  const items: PreviewItem[] = [];
  let previewIndex = 0;
  const nextIndex = () => previewIndex++;

  for (const row of rows) {
    if (row.type === "REGISTER") {
      items.push(...buildRegisterPreviewItems(row, list, nextIndex, mode));
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
          : matched ? undefined : "부과 대상자 미등록 (부과대상 등록 필요)",
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
  return normalizeDateString(value);
}

function firstValue(...values: any[]): any {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return undefined;
}

function normalizeJoinStatus(value: any): string {
  return String(value ?? "").trim();
}

function getRawJoinStatus(member: any): string {
  return normalizeJoinStatus(firstValue(
    member.membership_status,
    member.member_status,
    member.join_status,
    member.association_status,
    member.membership,
    member.joined,
    member.가입,
    member.가입여부,
    member.status
  ));
}

function isExplicitNonJoined(member: any): boolean {
  const status = getRawJoinStatus(member);
  if (!status) return false;
  return status.includes("미가입") || status === "x" || status === "X" || status === "false" || status === "0";
}

function mapMemberType(category: any, vehicleNo?: string): "개인회원" | "택배회원" {
  // 1단계 기준: 차량번호에 "배"가 들어간 배번호만 택배로 본다.
  // 배번호 제외 차량은 일반/개인 부과대상 판단으로 보며, 가입일자 기준 협회비 대상이다.
  if (String(vehicleNo || "").includes("배")) return "택배회원";
  return "개인회원";
}

function normalizeClosureTypeForImport(value: any): "폐업" | "양도" | "이관" {
  const text = String(value || "폐업").trim();
  if (text.includes("양")) return "양도";
  if (text.includes("이") || text.includes("타도")) return "이관";
  return "폐업";
}

function mapMemberSystemMemberToImportRow(member: any): ImportRow {
  const vehicleNo = firstValue(member.vehicle_number, member.vehicleNo, member.car_number, member.차량번호) || "";

  // 회원관리시스템 UI에는 "가입일자"가 18.10.24 같은 2자리 연도 포맷으로 표시될 수 있다.
  // API 필드명이 배포본마다 다를 수 있으므로 가능한 가입일자 후보를 폭넓게 읽는다.
  const rawJoinDate = firstValue(
    member.membership_date,
    member.membershipDate,
    member.membership_join_date,
    member.membershipJoinDate,
    member.association_membership_date,
    member.associationMembershipDate,
    member.association_join_date,
    member.associationJoinDate,
    member.association_date,
    member.associationDate,
    member.member_join_date,
    member.memberJoinDate,
    member.member_joined_date,
    member.memberJoinedDate,
    member.joinDate,
    member.join_date,
    member.joined_date,
    member.joinedDate,
    member.join_at,
    member.joinAt,
    member.joined_at,
    member.joinedAt,
    member.join_dt,
    member.registration_date,
    member.registrationDate,
    member.enrollment_date,
    member.enrollmentDate,
    member.signup_date,
    member.signupDate,
    member.가입일자,
    member.가입일,
    member.가입날짜,
    member.가입일시,
    member.협회가입일자,
    member.협회가입일,
    member.회원가입일자,
    member.회원가입일
  );
  const rawJoinStatus = getRawJoinStatus(member);

  const rawApprovalDate = firstValue(member.approval_date, member.approvalDate, member.authorization_date, member.인가일자, member.인가일);
  const rawCertificateDate = firstValue(
    member.certificate_issue_date,
    member.certificateDate,
    member.certificate_date,
    member.qualification_certificate_date,
    member.자격증명발급일자,
    member.자격증명발급일
  );

  const joinDate = isExplicitNonJoined(member) ? undefined : toDateString(rawJoinDate);
  const effectiveJoinStatus = rawJoinStatus || (isJoinMarker(rawJoinDate) ? "가입" : undefined);
  const rawMobile = firstValue(member.mobile, member.phone, member.핸드폰, member.휴대폰, member.mobile_no, member.phone_no, member.contact);
  const normalizedMobile = normalizeMobileForDb(rawMobile);

  return {
    type: "REGISTER",
    sourceSystemId: `MEMBER-${member.id ?? member.sourceSystemId ?? vehicleNo}`,
    managementNo: firstValue(member.management_number, member.managementNo, member.management_no, member.관리번호) || undefined,
    region: firstValue(member.region, member.지역) || undefined,
    vehicleNo,
    name: firstValue(member.name, member.성명, member.owner_name) || "",
    rrn: firstValue(member.resident_number, member.rrn, member.주민번호) || undefined,
    mobile: normalizedMobile.mobile,
    memberType: mapMemberType(member.category, vehicleNo),
    joinDate,
    joinStatus: effectiveJoinStatus || undefined,
    approvalDate: toDateString(rawApprovalDate),
    certificateDate: toDateString(rawCertificateDate),
    vehicleType: firstValue(member.vehicle_type, member.vehicleType, member.차종) || undefined,
    businessNo: firstValue(member.business_number, member.businessNo, member.사업자번호) || undefined,
    company: firstValue(member.affiliated_company, member.company_name, member.company, member.소속업체) || undefined,
    memo: appendOriginalMobileMemo(firstValue(member.memo, member.메모, member.note, member.비고), normalizedMobile.original, normalizedMobile.mobile),
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

function memberKey(member: any): string {
  const vehicleNo = String(firstValue(member.vehicle_number, member.vehicleNo, member.car_number, member.차량번호) || "").trim();
  const id = String(firstValue(member.id, member.sourceSystemId, member.member_id, member.memberId, "") || "").trim();
  return id ? `id:${id}` : `vehicle:${vehicleNo}`;
}

function looksLikePersonalCategory(member: any): boolean {
  const category = String(firstValue(member.category, member.member_category, member.memberType, member.구분, member.회원구분) || "").trim();
  if (!category) return true;
  if (category.includes("택배")) return false;
  return category.includes("개인") || category.includes("일반") || category === "회원" || category === "개인회원";
}


function getRawJoinDateCandidate(member: any): any {
  return firstValue(
    member.membership_date, member.membershipDate,
    member.membership_join_date, member.membershipJoinDate,
    member.association_membership_date, member.associationMembershipDate,
    member.association_join_date, member.associationJoinDate,
    member.association_date, member.associationDate,
    member.member_join_date, member.memberJoinDate,
    member.joinDate, member.join_date, member.joined_date, member.joinedDate,
    member.registration_date, member.registrationDate,
    member.가입일자, member.가입일, member.가입날짜, member.협회가입일자, member.회원가입일자
  );
}

function isStep2DeliveryManagementMember(member: any): boolean {
  const vehicleNo = String(firstValue(member.vehicle_number, member.vehicleNo, member.car_number, member.차량번호) || "").trim();
  if (!vehicleNo || !vehicleNo.includes("배")) return false;

  const rawStatus = getRawJoinStatus(member);
  const normalizedStatus = rawStatus.toLowerCase();
  const rawJoinDate = getRawJoinDateCandidate(member);
  const hasJoinDate = !!normalizeDateString(rawJoinDate) || isJoinMarker(rawJoinDate);
  const isNonJoined = rawStatus.includes("미가입") || normalizedStatus === "x" || normalizedStatus === "false" || normalizedStatus === "0";
  const isJoined = !isNonJoined && (rawStatus.includes("가입") || hasJoinDate);

  // 협회 가입자 택배는 협회비 대상이므로 2단계 관리비 추출에서 제외한다.
  if (isJoined) return false;

  // 배번호이면서 협회 가입자가 아니면 관리비 후보 또는 확인필요 후보로 미리보기한다.
  return true;
}

function isStep1JoinedGeneralMember(member: any): boolean {
  const vehicleNo = String(firstValue(member.vehicle_number, member.vehicleNo, member.car_number, member.차량번호) || "").trim();
  if (!vehicleNo || vehicleNo.includes("배")) return false;
  if (!looksLikePersonalCategory(member)) return false;

  const rawStatus = getRawJoinStatus(member);
  const normalizedStatus = rawStatus.toLowerCase();
  if (rawStatus.includes("미가입") || normalizedStatus === "x" || normalizedStatus === "false" || normalizedStatus === "0") return false;

  // 회원관리시스템 배포본마다 가입 여부 필드명이 달라서 다음 조건 중 하나면 가입자로 본다.
  // 1) membership_status/가입여부가 가입
  // 2) 가입일자 계열 필드가 있음
  // 단, 명시적 미가입은 위에서 제외한다.
  const mapped = mapMemberSystemMemberToImportRow(member) as any;
  const rawJoinDate = getRawJoinDateCandidate(member);
  return rawStatus.includes("가입") || !!mapped.joinDate || isJoinMarker(rawJoinDate);
}

function mergeMembers(...groups: any[][]): any[] {
  const map = new Map<string, any>();
  for (const group of groups) {
    for (const member of group || []) {
      const key = memberKey(member);
      if (!map.has(key)) map.set(key, member);
      else map.set(key, { ...member, ...map.get(key) });
    }
  }
  return Array.from(map.values());
}

export const billingRouter = router({
  // 부과대상 등록 연동 API
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
            status: "SUCCESS",
            message: "중복 데이터 발견 - 확인필요 상태로 변경",
          });

          return {
            status: "warning",
            message: "중복 데이터가 발견되어 확인필요 상태로 변경되었습니다.",
            candidateId: duplicateId,
          };
        }

        // 부과시작일 계산
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

        // 부과대상 생성
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
          certificateDate: input.certificateDate ? toDbDate(input.certificateDate) : undefined,
          certificateNo: input.certificateNo,
          licenseNo: input.licenseNo,
          vehicleType: input.vehicleType,
          fuelType: input.fuelType,
          businessNo: input.businessNo,
          company: input.company,
          joinDate: input.joinDate ? toDbDate(input.joinDate) : undefined,
          memo: input.memo,
          memberType: input.memberType,
          billingType,
          billingStartMonth: billingStartMonth || "",  // 부과시작일 없으면 빈 문자열
          status: determinedStatus,
        });

        const candidateId = result?.insertId || 1;

        // 연동 로그 기록
        const logMessage =
          determinedStatus === "확인필요"
            ? `필수 정보 부족 - ${input.memberType === "개인회원" ? "joinDate" : "certificateDate"} 확인 필요`
            : `${billingType} 대상자로 등록 (부과시작일: ${billingStartMonth})`;

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
              : `${billingType} 대상자로 등록되었습니다. (부과시작일: ${billingStartMonth})`,
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
          status: "성공",
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
      if (!input.status) {
        return candidates.filter((candidate: any) =>
          candidate.status !== "기존부과중" && candidate.status !== "반영완료"
        );
      }
      return candidates;
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
        status: z.enum(["대기", "부과예정", "부과반영완료", "확인필요", "보류", "제외", "기존부과중", "반영완료"]).optional(),
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
        step: z.enum(["generalFee", "deliveryManagementFee"]).optional().default("generalFee"),
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
        const step = input?.step || "generalFee";
        if (step === "deliveryManagementFee") {
          // 2단계: 택배 관리비 후보 추출.
          // 배포본마다 category/필터 동작이 달라서 택배 필터 + active 전체를 합친 뒤 최종 필터링한다.
          const deliveryFiltered = await fetchAllPagedFromMemberSystem(
            baseUrl,
            "/api/members?status=active&category=%ED%83%9D%EB%B0%B0",
            auth
          );
          const activeAll = await fetchAllPagedFromMemberSystem(baseUrl, "/api/members?status=active", auth);
          const mergedMembers = mergeMembers(deliveryFiltered, activeAll);
          const members = mergedMembers.filter(isStep2DeliveryManagementMember);

          membersCount = members.length;
          rows.push(...members.map(mapMemberSystemMemberToImportRow));
        } else {
          // 1단계: 회원관리시스템의 개인회원 탭에서 가입 상태인 일반 차량만 조회한다.
          // 일부 배포본은 membership_status 필터가 일부만 반환하므로,
          // 필터 조회 + 개인 전체 조회 + active 전체 조회를 합친 뒤 미수금 시스템에서 최종 필터링한다.
          const joinedFiltered = await fetchAllPagedFromMemberSystem(
            baseUrl,
            "/api/members?status=active&category=%EA%B0%9C%EC%9D%B8&membership_status=%EA%B0%80%EC%9E%85",
            auth
          );
          const personalAll = await fetchAllPagedFromMemberSystem(
            baseUrl,
            "/api/members?status=active&category=%EA%B0%9C%EC%9D%B8",
            auth
          );
          const activeAll = await fetchAllPagedFromMemberSystem(baseUrl, "/api/members?status=active", auth);

          const mergedMembers = mergeMembers(joinedFiltered, personalAll, activeAll);
          const members = mergedMembers.filter(isStep1JoinedGeneralMember);

          membersCount = members.length;
          rows.push(...members.map(mapMemberSystemMemberToImportRow));
        }
      }

      if (input?.includeClosures !== false) {
        const closures = await fetchAllPagedFromMemberSystem(baseUrl, "/api/closures", auth);
        closuresCount = closures.length;
        rows.push(...closures.map(mapMemberSystemClosureToImportRow));
      }

      const items = await buildPreview(rows, input?.step || "generalFee");
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
    .input(z.object({ rows: z.array(importRowSchema), step: z.enum(["generalFee", "deliveryManagementFee"]).optional().default("generalFee") }))
    .mutation(async ({ input }) => {
      const items = await buildPreview(input.rows, input.step);
      return { items };
    }),

  // 다음 달 부과 대상 삭제
  // 잘못 반영한 테스트 건을 화면에서 정리하기 위한 기능이다.
  // 이미 실제 부과 이력이 생성된 건은 안전상 삭제하지 않는다.
  deleteCandidate: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const existing = await getBillingCandidateById(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "삭제할 부과 대상자를 찾을 수 없습니다." });
      }

      const records = await getBillingRecords(input.id);
      if (records.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 부과/납부 이력이 연결된 대상자는 삭제할 수 없습니다. 보류 또는 제외 처리로 관리하세요.",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.delete(billingCandidates).where(eq(billingCandidates.id, input.id));

      await createSyncLog({
        eventType: "DELETE",
        sourceId: existing.sourceSystemId || `candidate-${input.id}`,
        targetId: String(input.id),
        status: "SUCCESS",
        message: `부과 대상 삭제: ${existing.vehicleNo || ""} ${existing.name || ""} / ${existing.billingType || ""}`.trim(),
      });

      return { status: "success", id: input.id };
    }),


  // 다음 달 부과 대상 전체 초기화
  // 실수로 대량 반영했거나 테스트 데이터를 지우고 처음부터 다시 불러오기 위한 기능이다.
  // 실제 부과/납부 이력이 연결된 건은 삭제하지 않고 건너뛴다.
  deleteAllCandidates: publicProcedure
    .input(z.object({ confirmText: z.literal("전체삭제") }))
    .mutation(async () => {
      const candidates = await getBillingCandidates();
      const list = await candidates;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      let deleted = 0;
      let skipped = 0;
      const skippedItems: string[] = [];

      for (const candidate of list as any[]) {
        const records = await getBillingRecords(candidate.id);
        if (records.length > 0) {
          skipped += 1;
          skippedItems.push(String(candidate.vehicleNo || "") + " " + String(candidate.name || ""));
          continue;
        }
        await db.delete(billingCandidates).where(eq(billingCandidates.id, candidate.id));
        deleted += 1;
      }

      await createSyncLog({
        eventType: "DELETE_ALL",
        sourceId: "billing_candidates",
        targetId: "0",
        status: "SUCCESS",
        message: "부과 대상 전체 초기화: 삭제 " + deleted + "건, 건너뜀 " + skipped + "건",
      });

      return { status: "success", deleted, skipped, skippedItems };
    }),

  // 회원관리 자료 불러오기 - 반영 (선택된 rowIndex만 처리)
  applyImport: publicProcedure
    .input(
      z.object({
        rows: z.array(importRowSchema),
        selectedIndexes: z.array(z.number()),
        step: z.enum(["generalFee", "deliveryManagementFee"]).optional().default("generalFee"),
      })
    )
    .mutation(async ({ input }) => {
      const preview = await buildPreview(input.rows, input.step);
      const selectedByUser = preview.filter((item) => input.selectedIndexes.includes(item.rowIndex));
      // 전체 후보는 모두 반영 처리한다.
      // 단, 부과시작일이 이번달/다음달인 사람만 예정자 목록에 남기고,
      // 과거 기존회원은 기존부과중 상태로 저장하여 예정자 목록에서는 숨긴다.
      const selected = selectedByUser;

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
                status: "SUCCESS",
                message: "중복 데이터 - 확인필요 상태로 변경",
              });
              results.push({ rowIndex: item.rowIndex, status: "warning", message: "중복 - 확인필요 처리" });
            } else {
              const billingType = item.billingType || "확인필요";
              const billingStartMonth = item.billingStartMonth || "";
              const scheduleTarget = isCurrentOrNextBillingTarget(item.billingStartMonth);
              const status = item.status === "확인필요"
                ? "확인필요"
                : (scheduleTarget ? (item.status || "대기") : "기존부과중");
              const normalizedMobile = normalizeMobileForDb(row.mobile);
              const result: any = await createBillingCandidate({
                sourceSystemId: item.sourceSystemId,
                managementNo: row.managementNo,
                region: row.region,
                vehicleNo: row.vehicleNo,
                name: row.name,
                rrn: row.rrn,
                mobile: normalizedMobile.mobile || row.mobile,
                vehicleType: row.vehicleType,
                businessNo: row.businessNo,
                company: row.company,
                // 협회비는 가입일자/인가일자만 저장하고, 관리비는 자격증명발급일자만 저장한다.
                // Date 객체 금지: MySQL DATE 컬럼에는 YYYY-MM-DD 문자열만 넣는다.
                joinDate: billingType === "협회비" ? (toDbDate(row.joinDate) || toDbDate(row.approvalDate)) : undefined,
                certificateDate: billingType === "관리비" ? toDbDate(row.certificateDate) : undefined,
                memo: appendOriginalMobileMemo([row.memo, item.billingSource ? `부과기준: ${item.billingSource}` : undefined, item.reason].filter(Boolean).join(" / ") || undefined, normalizedMobile.original, normalizedMobile.mobile),
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
                  : (status === "기존부과중"
                    ? `${billingType} 기존 부과대상 반영 완료 (부과시작일: ${billingStartMonth || "-"}, 기준: ${item.billingSource || "-"})`
                    : `${billingType} 예정자 등록 (부과시작일: ${billingStartMonth}, 기준: ${item.billingSource || "-"})`),
              });
              results.push({ rowIndex: item.rowIndex, status: "success", message: status === "기존부과중" ? `${billingType} 기존 부과대상 반영 완료` : `${billingType} 예정자 등록 완료` });
            }
          } else {
            // CLOSURE
            const row = item.raw as z.infer<typeof closureRowSchema>;
            const processDate = row.processDate ? new Date(row.processDate) : null;
            if (!processDate || Number.isNaN(processDate.getTime())) {
              await createSyncLog({
                eventType: "IMPORT",
                sourceId: row.sourceSystemId,
                status: "SUCCESS",
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
                status: "성공",
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


function __normalizeBillingPreviewV32(result: any): any {
  const normalizeItem = (item: any) => ({
    ...item,
    category: __billingImportCategory(item),
    status: item.status === '확인필요' ? '확인필요' : __billingImportStatus(item),
  });
  if (Array.isArray(result)) return result.map(normalizeItem);
  if (result && Array.isArray(result.preview)) return { ...result, preview: result.preview.map(normalizeItem) };
  if (result && Array.isArray(result.items)) return { ...result, items: result.items.map(normalizeItem) };
  return result;
}

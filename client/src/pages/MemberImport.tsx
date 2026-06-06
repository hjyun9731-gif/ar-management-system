import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Building2,
  HelpCircle,
  CalendarX,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ---- Types mirroring server schemas ----
type RegisterRow = {
  type: "REGISTER";
  sourceSystemId: string;
  managementNo?: string;
  region?: string;
  vehicleNo: string;
  name: string;
  rrn?: string;
  mobile?: string;
  memberType: "개인회원" | "택배회원";
  joinDate?: string;
  certificateDate?: string;
  vehicleType?: string;
  businessNo?: string;
  company?: string;
  memo?: string;
};

type ClosureRow = {
  type: "CLOSURE";
  sourceSystemId: string;
  closureType: "폐업" | "양도" | "이관";
  managementNo: string;
  region?: string;
  vehicleNo: string;
  name: string;
  processDate: string;
  receiptDate?: string;
};

type ImportRow = RegisterRow | ClosureRow;

type PreviewItem = {
  rowIndex: number;
  type: "REGISTER" | "CLOSURE";
  category: "신규" | "중복의심" | "날짜누락" | "확인필요" | "폐업양도이관";
  sourceSystemId: string;
  vehicleNo: string;
  name: string;
  memberType?: string;
  billingType?: string;
  billingStartMonth?: string;
  status?: string;
  duplicateId?: number;
  closureType?: string;
  excludeStartMonth?: string;
  matchedCandidateId?: number;
  reason?: string;
};

// ---- CSV parser ----
function parseCSV(text: string): ImportRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error("CSV에 헤더와 데이터 행이 필요합니다.");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? "";
    });

    const type = obj["type"]?.toUpperCase();
    if (type === "REGISTER") {
      rows.push({
        type: "REGISTER",
        sourceSystemId: obj["sourceSystemId"] || `IMPORT-${i}`,
        managementNo: obj["managementNo"] || undefined,
        region: obj["region"] || undefined,
        vehicleNo: obj["vehicleNo"] || "",
        name: obj["name"] || "",
        rrn: obj["rrn"] || undefined,
        mobile: obj["mobile"] || undefined,
        memberType: (obj["memberType"] as "개인회원" | "택배회원") || "개인회원",
        joinDate: obj["joinDate"] || undefined,
        certificateDate: obj["certificateDate"] || undefined,
        vehicleType: obj["vehicleType"] || undefined,
        businessNo: obj["businessNo"] || undefined,
        company: obj["company"] || undefined,
        memo: obj["memo"] || undefined,
      });
    } else if (type === "CLOSURE") {
      rows.push({
        type: "CLOSURE",
        sourceSystemId: obj["sourceSystemId"] || `IMPORT-${i}`,
        closureType: (obj["closureType"] as "폐업" | "양도" | "이관") || "폐업",
        managementNo: obj["managementNo"] || "",
        region: obj["region"] || undefined,
        vehicleNo: obj["vehicleNo"] || "",
        name: obj["name"] || "",
        processDate: obj["processDate"] || "",
        receiptDate: obj["receiptDate"] || undefined,
      });
    }
  }

  return rows;
}

// ---- Category badge ----
const CATEGORY_CONFIG: Record<
  string,
  { label: string; style: string; icon: React.ElementType }
> = {
  신규: { label: "신규 대상자", style: "bg-sky-50 text-sky-700 border border-sky-200", icon: Users },
  폐업양도이관: { label: "폐업/양도/이관", style: "bg-red-50 text-red-700 border border-red-200", icon: Building2 },
  중복의심: { label: "중복 의심", style: "bg-amber-50 text-amber-700 border border-amber-200", icon: AlertTriangle },
  날짜누락: { label: "날짜 누락", style: "bg-orange-50 text-orange-700 border border-orange-200", icon: CalendarX },
  확인필요: { label: "확인 필요", style: "bg-violet-50 text-violet-700 border border-violet-200", icon: HelpCircle },
};

const SAMPLE_CSV = `type,sourceSystemId,vehicleNo,name,memberType,joinDate,certificateDate,managementNo,region,closureType,processDate
REGISTER,MEM-001,12가3456,홍길동,개인회원,2026-05-15,,MGT-001,강원,,
REGISTER,MEM-002,34나5678,김철수,택배회원,,2026-04-20,MGT-002,강원,,
REGISTER,MEM-003,56다7890,이영희,개인회원,,,MGT-003,강원,,
CLOSURE,CLO-001,12가3456,홍길동,,,,MGT-001,강원,폐업,2026-05-31`;

export default function MemberImport() {
  const [inputText, setInputText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [applyResult, setApplyResult] = useState<{
    successCount: number;
    warningCount: number;
    failCount: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewMutation = trpc.billing.previewImport.useMutation({
    onSuccess: (data) => {
      setPreview(data.items as PreviewItem[]);
      setSelectedIndexes(new Set(data.items.map((i: any) => i.rowIndex)));
      setApplyResult(null);
    },
    onError: (err) => {
      toast.error(err.message || "미리보기 실패");
    },
  });

  const applyMutation = trpc.billing.applyImport.useMutation({
    onSuccess: (data) => {
      setApplyResult({
        successCount: data.successCount,
        warningCount: data.warningCount,
        failCount: data.failCount,
      });
      setPreview(null);
      toast.success(`반영 완료: 성공 ${data.successCount}건, 경고 ${data.warningCount}건, 실패 ${data.failCount}건`);
    },
    onError: (err) => {
      toast.error(err.message || "반영 실패");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setInputText(ev.target?.result as string);
      setParseError(null);
      setPreview(null);
    };
    reader.readAsText(file, "utf-8");
  };

  const handlePreview = () => {
    setParseError(null);
    let rows: ImportRow[];
    try {
      const trimmed = inputText.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        rows = parseCSV(trimmed);
      }
    } catch (e: any) {
      setParseError(e.message || "파싱 오류");
      return;
    }
    if (rows.length === 0) {
      setParseError("처리할 데이터가 없습니다.");
      return;
    }
    previewMutation.mutate({ rows });
  };

  const toggleRow = (idx: number) => {
    setSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!preview) return;
    if (selectedIndexes.size === preview.length) {
      setSelectedIndexes(new Set());
    } else {
      setSelectedIndexes(new Set(preview.map((i) => i.rowIndex)));
    }
  };

  const handleApply = () => {
    if (!preview || selectedIndexes.size === 0) return;
    const trimmed = inputText.trim();
    let rows: ImportRow[];
    try {
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        rows = parseCSV(trimmed);
      }
    } catch {
      toast.error("원본 데이터 파싱 오류");
      return;
    }
    applyMutation.mutate({ rows, selectedIndexes: Array.from(selectedIndexes) });
  };

  // summary counts
  const counts = preview
    ? {
        신규: preview.filter((i) => i.category === "신규").length,
        폐업양도이관: preview.filter((i) => i.category === "폐업양도이관").length,
        중복의심: preview.filter((i) => i.category === "중복의심").length,
        날짜누락: preview.filter((i) => i.category === "날짜누락").length,
        확인필요: preview.filter((i) => i.category === "확인필요").length,
      }
    : null;

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">회원관리 자료 불러오기</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          외부 회원관리 시스템 자료를 CSV 또는 JSON으로 불러와 부과 대상자에 반영합니다.
        </p>
      </div>

      {/* Apply result banner */}
      {applyResult && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">반영이 완료되었습니다.</p>
            <p className="text-xs text-emerald-700 mt-1">
              성공 <strong>{applyResult.successCount}건</strong> · 경고{" "}
              <strong>{applyResult.warningCount}건</strong> · 실패{" "}
              <strong>{applyResult.failCount}건</strong>
            </p>
          </div>
          <a
            href="/sync-logs"
            className="text-xs text-emerald-700 font-medium flex items-center gap-1 hover:underline"
          >
            연동 로그 보기 <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Input area */}
      <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            자료 입력
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4 space-y-3">
          {/* File upload */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              CSV 파일 선택
            </Button>
            <span className="text-xs text-slate-400">또는 아래에 CSV / JSON을 직접 붙여넣기</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Textarea */}
          <textarea
            className="w-full h-40 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-slate-50"
            placeholder={`CSV 예시:\n${SAMPLE_CSV}`}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setParseError(null);
              setPreview(null);
            }}
          />

          {parseError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {parseError}
            </div>
          )}

          {/* Sample / Preview button */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handlePreview}
              disabled={!inputText.trim() || previewMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            >
              {previewMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              미리보기
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-500"
              onClick={() => {
                setInputText(SAMPLE_CSV);
                setParseError(null);
                setPreview(null);
              }}
            >
              예시 데이터 불러오기
            </Button>
          </div>

          {/* Format hint */}
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer hover:text-slate-600 font-medium">CSV 컬럼 설명 보기</summary>
            <div className="mt-2 space-y-1 pl-2 border-l border-slate-200">
              <p><span className="font-mono text-slate-600">type</span> — REGISTER 또는 CLOSURE</p>
              <p><span className="font-mono text-slate-600">sourceSystemId</span> — 원본 시스템 고유 ID</p>
              <p><span className="font-mono text-slate-600">memberType</span> — 개인회원 / 택배회원 (REGISTER만)</p>
              <p><span className="font-mono text-slate-600">joinDate</span> — 가입일자 (개인회원 필수, YYYY-MM-DD)</p>
              <p><span className="font-mono text-slate-600">certificateDate</span> — 자격증명 발급일 (택배회원 필수, YYYY-MM-DD)</p>
              <p><span className="font-mono text-slate-600">closureType</span> — 폐업 / 양도 / 이관 (CLOSURE만)</p>
              <p><span className="font-mono text-slate-600">processDate</span> — 처리일자 (CLOSURE 필수, YYYY-MM-DD)</p>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && counts && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(["신규", "폐업양도이관", "중복의심", "날짜누락", "확인필요"] as const).map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const Icon = cfg.icon;
              return (
                <div
                  key={cat}
                  className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${cfg.style}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <div className="text-xl font-bold tabular-nums">{counts[cat]}</div>
                    <div className="text-xs font-medium">{cfg.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preview table */}
          <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  미리보기 목록 ({preview.length}건)
                </CardTitle>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAll}
                    className="text-xs text-indigo-600 hover:underline font-medium"
                  >
                    {selectedIndexes.size === preview.length ? "전체 해제" : "전체 선택"}
                  </button>
                  <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 font-medium">
                    {selectedIndexes.size}건 선택됨
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-100">
                      <TableHead className="pl-5 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIndexes.size === preview.length}
                          onChange={toggleAll}
                          className="cursor-pointer"
                        />
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">구분</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">차량번호</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">성명</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">카테고리</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">부과항목</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">부과시작월 / 제외시작월</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide pr-5">비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((item) => {
                      const cfg = CATEGORY_CONFIG[item.category];
                      const Icon = cfg.icon;
                      const isSelected = selectedIndexes.has(item.rowIndex);
                      return (
                        <TableRow
                          key={item.rowIndex}
                          className={`border-b border-slate-50 cursor-pointer ${isSelected ? "hover:bg-slate-50" : "opacity-50 bg-slate-50"}`}
                          onClick={() => toggleRow(item.rowIndex)}
                        >
                          <TableCell className="pl-5 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRow(item.rowIndex)}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 py-3 font-medium">
                            {item.type === "REGISTER" ? "신규등록" : "폐업/양도/이관"}
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-slate-900 py-3 font-mono">
                            {item.vehicleNo}
                          </TableCell>
                          <TableCell className="text-sm text-slate-800 py-3">{item.name}</TableCell>
                          <TableCell className="py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${cfg.style}`}>
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700 py-3">
                            {item.type === "REGISTER" ? (
                              item.billingType ? (
                                <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${
                                  item.billingType === "협회비"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : item.billingType === "관리비"
                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}>
                                  {item.billingType}
                                </span>
                              ) : "-"
                            ) : (
                              <span className="inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 bg-red-50 text-red-700 border border-red-200">
                                {item.closureType}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-700 py-3 font-mono">
                            {item.type === "REGISTER"
                              ? item.billingStartMonth || <span className="text-slate-300">-</span>
                              : item.excludeStartMonth || <span className="text-slate-300">-</span>}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 py-3 pr-5 max-w-[200px] truncate">
                            {item.reason || (item.type === "CLOSURE" && !item.matchedCandidateId
                              ? "⚠ 미등록 회원"
                              : "-")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Apply button */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-4">
            <div className="text-sm text-slate-600">
              선택된 <strong className="text-slate-900">{selectedIndexes.size}건</strong>을 부과 대상자 / 폐업 현황에 반영합니다.
              기존 납부 이력은 변경되지 않습니다.
            </div>
            <Button
              onClick={handleApply}
              disabled={selectedIndexes.size === 0 || applyMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            >
              {applyMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {applyMutation.isPending ? "반영 중..." : `${selectedIndexes.size}건 반영`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

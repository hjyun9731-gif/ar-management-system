import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { Upload, Search, Loader2, Database, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ParsedPaymentRow = {
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  region?: string;
  account?: string;
  vehicleNo: string;
  name: string;
  billingMonth: string;
  billingType?: string;
  expectedAmount?: number;
  paidAmount?: number;
  unpaidAmount?: number;
  memo?: string;
};

type LocalSummaryRow = {
  key: string;
  vehicleNo: string;
  name: string;
  region: string;
  account: string;
  billingType: string;
  billingStartMonth: string;
  historyCount: number;
  balanceMonths: number;
  latestBalance: number;
  latestMonth: string;
  lastDecreaseMonth: string;
};

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function parseMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const raw = cleanText(value)
    .replace(/,/g, "")
    .replace(/원/g, "")
    .replace(/▲/g, "-")
    .trim();
  if (!raw || raw === "-" || raw === "납부" || raw === "미납") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function indexOfHeader(headers: string[], names: string[]): number {
  return headers.findIndex((h) => names.some((n) => h === n || h.includes(n)));
}

function findVehicle(raw: string): string | undefined {
  const compact = raw.replace(/\s+/g, "");
  const m = compact.match(/강원\d{2,3}[가-힣]\d{4}호?/);
  if (!m) return undefined;
  return m[0].endsWith("호") ? m[0] : m[0] + "호";
}

function findYear(raw: string): string | undefined {
  return raw.match(/(20\d{2}|19\d{2})/)?.[1];
}

function findMonth(raw: string, fallbackYear?: string): string | undefined {
  let m = raw.match(/(20\d{2}|19\d{2})\s*[.\-/년]?\s*(\d{1,2})\s*월?/);
  if (m) return m[1] + "-" + String(Number(m[2])).padStart(2, "0");

  m = raw.match(/(\d{2})\s*[.\-/년]?\s*(\d{1,2})\s*월?/);
  if (m) {
    const yy = Number(m[1]);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return year + "-" + String(Number(m[2])).padStart(2, "0");
  }

  m = raw.match(/(\d{1,2})\s*월/);
  if (m && fallbackYear) return fallbackYear + "-" + String(Number(m[1])).padStart(2, "0");

  return undefined;
}

function inferBillingType(raw: string): string | undefined {
  if (raw.includes("관리비")) return "관리비";
  if (raw.includes("협회비")) return "협회비";
  return undefined;
}

function pickName(cells: unknown[], vehicleIndex: number): string | undefined {
  const candidates = [
    cells[vehicleIndex - 2],
    cells[vehicleIndex - 1],
    cells[vehicleIndex + 1],
    cells[vehicleIndex + 2],
    cells[vehicleIndex + 3],
  ].map(cleanText).filter(Boolean);

  return candidates.find((v) => {
    if (v.includes("강원")) return false;
    if (/\d{4}/.test(v)) return false;
    if (v.includes("협회") || v.includes("관리") || v.includes("미수") || v.includes("합계")) return false;
    return /^[가-힣A-Za-z0-9()·\s]{2,20}$/.test(v);
  });
}

function parsePreparedCsv(fileName: string, csvText: string): ParsedPaymentRow[] {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, "").trim());
  const idx = (names: string[]) => indexOfHeader(headers, names);

  const monthIdx = idx(["부과월", "billingMonth", "billing_month", "월"]);
  const vehicleIdx = idx(["차량번호", "vehicleNo", "vehicle_no"]);
  const nameIdx = idx(["성명", "name", "이름"]);
  const regionIdx = idx(["지역", "region"]);
  const accountIdx = idx(["계정", "account"]);
  const typeIdx = idx(["부과항목", "billingType", "billing_type"]);
  const expectedIdx = idx(["월부과액_기준", "월부과액", "부과액", "expectedAmount", "expected_amount"]);
  const paidIdx = idx(["납부액_잔액변화추정", "추정납부액", "납부액", "입금액", "paidAmount", "paid_amount"]);
  const unpaidIdx = idx(["당월잔액", "미수금액", "미납액", "unpaidAmount", "unpaid_amount"]);
  const memoIdx = idx(["판정", "비고", "memo"]);

  return lines.slice(1).map((line, i) => {
    const cols = splitCsvLine(line);
    return {
      sourceFile: fileName,
      sourceSheet: "CSV",
      sourceRow: i + 2,
      region: regionIdx >= 0 ? cols[regionIdx] : "",
      account: accountIdx >= 0 ? cols[accountIdx] : "",
      vehicleNo: vehicleIdx >= 0 ? cols[vehicleIdx] : "",
      name: nameIdx >= 0 ? cols[nameIdx] : "",
      billingMonth: monthIdx >= 0 ? cols[monthIdx] : "",
      billingType: typeIdx >= 0 ? cols[typeIdx] : "",
      expectedAmount: expectedIdx >= 0 ? parseMoney(cols[expectedIdx]) : undefined,
      paidAmount: paidIdx >= 0 ? parseMoney(cols[paidIdx]) : 0,
      unpaidAmount: unpaidIdx >= 0 ? parseMoney(cols[unpaidIdx]) : 0,
      memo: memoIdx >= 0 ? cols[memoIdx] : "잔액변화 기반 추정자료",
    };
  }).filter((row) => row.vehicleNo && row.name && row.billingMonth);
}

function parseSheet(fileName: string, sheetName: string, rows: unknown[][]): ParsedPaymentRow[] {
  const result: ParsedPaymentRow[] = [];
  const context = fileName + " " + sheetName;
  const fallbackYear = findYear(context);
  const sheetMonth = findMonth(context);

  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const h = (rows[i] || []).map(cleanText);
    const joined = h.join(" ");
    if (joined.includes("차량") || joined.includes("성명") || joined.includes("이름") || joined.includes("미수")) {
      headerIndex = i;
      headers = h;
      break;
    }
  }

  const vehicleCol = indexOfHeader(headers, ["차량번호", "차량", "차번"]);
  const nameCol = indexOfHeader(headers, ["성명", "이름", "대표자"]);
  const regionCol = indexOfHeader(headers, ["지역"]);
  const accountCol = indexOfHeader(headers, ["계정"]);
  const typeCol = indexOfHeader(headers, ["부과항목", "구분", "항목"]);
  const unpaidCol = indexOfHeader(headers, ["미수", "미납", "체납", "잔액"]);
  const paidCol = indexOfHeader(headers, ["입금", "납부"]);
  const monthCol = indexOfHeader(headers, ["부과월", "기준월", "년월", "월"]);

  const monthColumns: { index: number; month: string }[] = [];
  headers.forEach((h, index) => {
    const month = findMonth(h, fallbackYear);
    if (month) monthColumns.push({ index, month });
  });

  for (let r = 0; r < rows.length; r++) {
    if (r === headerIndex) continue;
    const cells = rows[r] || [];
    const rowText = cells.map(cleanText).join(" ");
    if (!rowText.trim()) continue;

    let vehicleNo = vehicleCol >= 0 ? cleanText(cells[vehicleCol]) : findVehicle(rowText);
    if (vehicleNo && !vehicleNo.endsWith("호") && /강원\d{2,3}[가-힣]\d{4}/.test(vehicleNo.replace(/\s+/g, ""))) vehicleNo += "호";
    if (!vehicleNo || !findVehicle(vehicleNo)) vehicleNo = findVehicle(rowText);
    if (!vehicleNo) continue;

    const vehicleIndex = cells.findIndex((c) => cleanText(c).replace(/\s+/g, "").includes(vehicleNo!.replace(/\s+/g, "").replace(/호$/, "").slice(-4)));
    const name = nameCol >= 0 ? cleanText(cells[nameCol]) : pickName(cells, vehicleIndex >= 0 ? vehicleIndex : 0);
    if (!name) continue;

    const billingType = typeCol >= 0 ? inferBillingType(cleanText(cells[typeCol])) || inferBillingType(rowText) : inferBillingType(rowText);
    const region = regionCol >= 0 ? cleanText(cells[regionCol]) : "";
    const account = accountCol >= 0 ? cleanText(cells[accountCol]) : "";

    if (monthColumns.length >= 2) {
      for (const mc of monthColumns) {
        const cellValue = cells[mc.index];
        const unpaidAmount = parseMoney(cellValue);
        if (!unpaidAmount && !cleanText(cellValue)) continue;
        result.push({
          sourceFile: fileName,
          sourceSheet: sheetName,
          sourceRow: r + 1,
          region,
          account,
          vehicleNo,
          name,
          billingMonth: mc.month,
          billingType,
          expectedAmount: billingType === "관리비" ? 5000 : billingType === "협회비" ? 10000 : undefined,
          paidAmount: 0,
          unpaidAmount,
          memo: "월별 미수금 칸",
        });
      }
      continue;
    }

    const billingMonth = monthCol >= 0 ? findMonth(cleanText(cells[monthCol]), fallbackYear) : sheetMonth;
    if (!billingMonth) continue;

    const unpaidAmount = unpaidCol >= 0 ? parseMoney(cells[unpaidCol]) : amountGuess(cells);
    const paidAmount = paidCol >= 0 ? parseMoney(cells[paidCol]) : 0;

    result.push({
      sourceFile: fileName,
      sourceSheet: sheetName,
      sourceRow: r + 1,
      region,
      account,
      vehicleNo,
      name,
      billingMonth,
      billingType,
      expectedAmount: billingType === "관리비" ? 5000 : billingType === "협회비" ? 10000 : undefined,
      paidAmount,
      unpaidAmount,
      memo: "행 단위 추출",
    });
  }

  return result;
}

function amountGuess(cells: unknown[]): number {
  const nums = cells.map(parseMoney).filter((n) => n > 0);
  return nums.length ? nums[nums.length - 1] : 0;
}

async function parseWorkbook(name: string, data: ArrayBuffer): Promise<ParsedPaymentRow[]> {
  const workbook = XLSX.read(data, { type: "array", cellDates: false, raw: false });
  const all: ParsedPaymentRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
    pushMany(all, parseSheet(name, sheetName, rows));
  }
  return all;
}

function pushMany<T>(target: T[], items: T[]) {
  for (let i = 0; i < items.length; i++) target.push(items[i]);
}

function moneyLabel(value: number | undefined): string {
  return Number(value || 0).toLocaleString() + "원";
}

function buildLocalSummary(rows: ParsedPaymentRow[]): LocalSummaryRow[] {
  const map = new Map<string, LocalSummaryRow>();

  for (const row of rows) {
    const key = row.vehicleNo + "|" + row.name + "|" + (row.billingType || "");
    const prev = map.get(key) || {
      key,
      vehicleNo: row.vehicleNo,
      name: row.name,
      region: row.region || "",
      account: row.account || "",
      billingType: row.billingType || "",
      billingStartMonth: row.billingMonth,
      historyCount: 0,
      balanceMonths: 0,
      latestBalance: 0,
      latestMonth: row.billingMonth,
      lastDecreaseMonth: "",
    };

    prev.historyCount += 1;
    if (Number(row.unpaidAmount || 0) > 0) prev.balanceMonths += 1;
    if (row.billingMonth < prev.billingStartMonth) prev.billingStartMonth = row.billingMonth;
    if (row.billingMonth >= prev.latestMonth) {
      prev.latestMonth = row.billingMonth;
      prev.latestBalance = Number(row.unpaidAmount || 0);
    }
    if (Number(row.paidAmount || 0) > 0 && row.billingMonth >= (prev.lastDecreaseMonth || "")) {
      prev.lastDecreaseMonth = row.billingMonth;
    }

    map.set(key, prev);
  }

  return Array.from(map.values()).sort((a, b) => b.latestBalance - a.latestBalance || a.vehicleNo.localeCompare(b.vehicleNo));
}

export default function PaymentHistory() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedPaymentRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const summaryQuery = trpc.billing.paymentHistorySummary.useQuery(undefined, { retry: false });
  const importMutation = trpc.billing.paymentHistoryImportRows.useMutation({
    onSuccess: (data: any) => {
      toast.success("저장 " + Number(data.insertedCount || 0).toLocaleString() + "건");
      summaryQuery.refetch();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const localSummary = useMemo(() => buildLocalSummary(parsedRows), [parsedRows]);

  const summaryRows = useMemo(() => {
    if (localSummary.length) return localSummary;
    const serverRows = summaryQuery.data || [];
    return serverRows.map((row: any) => ({
      key: String(row.candidateId || row.vehicleNo + row.name),
      vehicleNo: row.vehicleNo || "",
      name: row.name || "",
      region: row.region || "",
      account: "",
      billingType: row.billingType || "",
      billingStartMonth: row.billingStartMonth || "",
      historyCount: Number(row.historyCount || 0),
      balanceMonths: Number(row.unpaidMonths || 0),
      latestBalance: Number(row.totalUnpaid || 0),
      latestMonth: row.latestMonth || "",
      lastDecreaseMonth: row.lastPaidMonth || "",
    }));
  }, [localSummary, summaryQuery.data]);

  const filteredSummary = useMemo(() => {
    const q = search.trim();
    if (!q) return summaryRows;
    return summaryRows.filter((r) =>
      r.vehicleNo.includes(q) ||
      r.name.includes(q) ||
      r.region.includes(q) ||
      r.billingType.includes(q)
    );
  }, [summaryRows, search]);

  const selectedDetailRows = useMemo(() => {
    if (!selectedKey) return [];
    return parsedRows
      .filter((row) => row.vehicleNo + "|" + row.name + "|" + (row.billingType || "") === selectedKey)
      .sort((a, b) => a.billingMonth.localeCompare(b.billingMonth));
  }, [parsedRows, selectedKey]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsParsing(true);
    setSelectedKey(null);
    try {
      const allRows: ParsedPaymentRow[] = [];

      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          const zip = await JSZip.loadAsync(await file.arrayBuffer());
          const allEntries = Object.values(zip.files).filter((entry) => !entry.dir);
          const preparedCsv = allEntries.find((entry) =>
            /프로그램업로드용.*잔액변화납부이력.*\.csv$/i.test(entry.name) ||
            /잔액변화납부이력.*\.csv$/i.test(entry.name)
          );

          if (preparedCsv) {
            pushMany(allRows, parsePreparedCsv(preparedCsv.name, await preparedCsv.async("string")));
          } else {
            const entries = allEntries.filter((entry) =>
              /\.(xlsx|xlsm|xls|csv)$/i.test(entry.name) &&
              !/요약|README|작업요약/i.test(entry.name)
            );

            for (const entry of entries) {
              if (/\.csv$/i.test(entry.name)) {
                pushMany(allRows, parsePreparedCsv(entry.name, await entry.async("string")));
              } else {
                pushMany(allRows, await parseWorkbook(entry.name, await entry.async("arraybuffer")));
              }
            }
          }
        } else if (/\.csv$/i.test(file.name)) {
          pushMany(allRows, parsePreparedCsv(file.name, await file.text()));
        } else if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
          pushMany(allRows, await parseWorkbook(file.name, await file.arrayBuffer()));
        }
      }

      setParsedRows(allRows);
      toast.success("추출 완료: " + allRows.length.toLocaleString() + "건");
    } catch (error: any) {
      toast.error(error.message || "파일 파싱 실패");
    } finally {
      setIsParsing(false);
    }
  };

  const saveRows = async () => {
    if (!parsedRows.length) return;

    const compactRows = parsedRows.map((row) => ({
      sourceFile: row.sourceFile,
      sourceSheet: row.sourceSheet,
      sourceRow: row.sourceRow,
      region: row.region || "",
      account: row.account || "",
      vehicleNo: row.vehicleNo,
      name: row.name,
      billingMonth: row.billingMonth,
      billingType: row.billingType || "",
      expectedAmount: Number(row.expectedAmount || 0),
      paidAmount: Number(row.paidAmount || 0),
      unpaidAmount: Number(row.unpaidAmount || 0),
      memo: row.memo || "잔액변화 기반 추정자료",
    }));

    const size = 200;
    for (let i = 0; i < compactRows.length; i += size) {
      await importMutation.mutateAsync({
        fileName: "과거 미수금 자료",
        rows: compactRows.slice(i, i + size),
      });
      toast.info("저장 진행: " + Math.min(i + size, compactRows.length).toLocaleString() + " / " + compactRows.length.toLocaleString() + "건");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    toast.success("과거 납부·미수금 자료 저장 완료");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">납부이력 추적</h1>
        <div className="text-xs text-emerald-600 font-semibold mt-1">v63 요청 컬럼 정리 화면</div>
        <p className="text-sm text-slate-500 mt-1">
          현재 부과대상자 기준으로 과거 납부이력을 사람별 요약으로 조회합니다. 차량번호를 클릭하면 월별 상세를 확인합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            자료 업로드
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input ref={fileRef} type="file" multiple accept=".xlsx,.xlsm,.xls,.zip,.csv" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={() => fileRef.current?.click()} disabled={isParsing}>
              {isParsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              엑셀/ZIP/CSV 선택
            </Button>
            <Button variant="outline" onClick={saveRows} disabled={!parsedRows.length || importMutation.isPending}>
              {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
              추출자료 저장
            </Button>
            <span className="text-sm text-slate-600">
              추출: <b>{parsedRows.length.toLocaleString()}</b>건 / 요약: <b>{localSummary.length.toLocaleString()}</b>명
            </span>
          </div>
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            기본 화면에는 사람별 요약만 표시합니다. 잔액감소(추정)는 실제 통장 입금액이 아니라 잔액 변화로 역산한 값이므로, 차량번호를 클릭한 상세에서만 확인합니다.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">납부이력 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-slate-400" />
            <Input placeholder="차량번호/성명/지역 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>차량번호</TableHead>
                  <TableHead>성명</TableHead>
                  <TableHead>지역</TableHead>
                  <TableHead>부과항목</TableHead>
                  <TableHead>부과시작월</TableHead>
                  <TableHead className="text-right">부과개월수</TableHead>
                  <TableHead className="text-right">미납발생개월수</TableHead>
                  <TableHead className="text-right">미수금</TableHead>
                  <TableHead>최근납부일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummary.map((row) => (
                  <TableRow key={row.key} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedKey(row.key)}>
                    <TableCell className="font-mono font-semibold text-blue-700 underline">{row.vehicleNo}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.region || "-"}</TableCell>
                    <TableCell>{row.billingType || "-"}</TableCell>
                    <TableCell>{row.billingStartMonth || "-"}</TableCell>
                    <TableCell className="text-right">{row.historyCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.balanceMonths.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">{moneyLabel(row.latestBalance)}</TableCell>
                    <TableCell>{row.lastDecreaseMonth || "-"}</TableCell>
                  </TableRow>
                ))}
                {!filteredSummary.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                      납부이력 자료가 없습니다. 정리된 ZIP 또는 CSV를 업로드해 주세요.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedKey && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <div className="font-bold text-lg">월별 상세 이력</div>
                <div className="text-sm text-slate-500">
                  {selectedDetailRows[0]?.vehicleNo} / {selectedDetailRows[0]?.name} / {selectedDetailRows[0]?.billingType || "-"}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedKey(null)}>
                <X className="w-4 h-4 mr-1" />
                닫기
              </Button>
            </div>
            <div className="overflow-auto max-h-[70vh] p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>월</TableHead>
                    <TableHead>부과항목</TableHead>
                    <TableHead className="text-right">월부과액</TableHead>
                    <TableHead className="text-right">잔액감소(추정)</TableHead>
                    <TableHead className="text-right">당월잔액</TableHead>
                    <TableHead>원본</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDetailRows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.billingMonth}</TableCell>
                      <TableCell>{row.billingType || "-"}</TableCell>
                      <TableCell className="text-right">{moneyLabel(row.expectedAmount)}</TableCell>
                      <TableCell className="text-right">{moneyLabel(row.paidAmount)}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">{moneyLabel(row.unpaidAmount)}</TableCell>
                      <TableCell className="text-xs text-slate-500">{row.sourceFile} / {row.sourceSheet}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

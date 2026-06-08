import { useMemo, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";

type SummaryRow = {
  sourceFile?: string;
  currentId?: string;
  region?: string;
  account?: string;
  billingType?: string;
  vehicleNo: string;
  name: string;
  note?: string;
  billingStartMonth?: string;
  latestMonth?: string;
  historyCount?: number;
  totalUnpaid?: number;
  unpaidMonths?: number;
  paidEventMonths?: number;
  paidTotalAmount?: number;
  lastPaidMonth?: string;
  monthlyAmount?: number;
};

type MonthlyRow = {
  sourceFile?: string;
  sourceSheet?: string;
  sourceRow?: number;
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

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result;
}

function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cols[index] ?? "").trim();
    });
    return row;
  });
}

function num(value: unknown): number {
  const n = Number(String(value ?? "").replace(/,/g, "").replace(/원/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function money(value: unknown): string {
  return num(value).toLocaleString("ko-KR") + "원";
}

function normalizeVehicle(value: unknown): string {
  const text = String(value || "").replace(/\s+/g, "").trim();
  if (!text) return "";
  return text.endsWith("호") ? text : text + "호";
}

function summaryFromCsvRow(row: Record<string, string>, sourceFile: string): SummaryRow | null {
  const vehicleNo = normalizeVehicle(row["차량번호"]);
  const name = String(row["성명"] || "").trim();
  if (!vehicleNo || !name) return null;

  return {
    sourceFile,
    currentId: row["current_id"] || "",
    region: row["지역"] || "",
    account: row["계정"] || "",
    billingType: row["계정"] || "",
    vehicleNo,
    name,
    note: row["비고"] || "",
    billingStartMonth: row["첫기록월"] || row["기록시작월"] || "",
    latestMonth: row["최근원본월"] || row["마지막기록월"] || "",
    historyCount: num(row["원본확인월수"]),
    totalUnpaid: num(row["최근월말잔액"]),
    unpaidMonths: num(row["잔액있는월수"]),
    paidEventMonths: num(row["추정납부발생월수"]),
    paidTotalAmount: num(row["추정납부합계"]),
    lastPaidMonth: row["추정마지막납부월"] || "",
    monthlyAmount: num(row["월부과액기준"]),
  };
}

function monthlyFromCsvRow(row: Record<string, string>, sourceFile: string, index: number): MonthlyRow | null {
  const vehicleNo = normalizeVehicle(row["차량번호"]);
  const name = String(row["성명"] || "").trim();
  const billingMonth = row["부과월"] || "";
  if (!vehicleNo || !name || !billingMonth) return null;

  return {
    sourceFile,
    sourceSheet: "CSV",
    sourceRow: index + 2,
    region: row["지역"] || "",
    account: row["계정"] || "",
    vehicleNo,
    name,
    billingMonth,
    billingType: row["부과항목"] || row["계정"] || "",
    expectedAmount: num(row["월부과액_기준"]),
    paidAmount: num(row["납부액_잔액변화추정"]),
    unpaidAmount: num(row["원본부과금_사용안함"]),
    memo: row["확인메모"] || "",
  };
}


function compactNameV78(value: unknown): string {
  return String(value || "").replace(/\s+/g, "").trim();
}

function normalizeVehicleFrom2026V78(value: unknown): string {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.startsWith("강원") && raw.endsWith("호")) return raw;

  const compact = raw.replace(/\s+/g, "");
  let m = compact.match(/^(\d{2})-(\d{4})$/);
  if (m) return `강원${m[1]}자 ${m[2]}호`;

  m = compact.match(/^(\d{2})(자|배|바)(\d{4})$/);
  if (m) return `강원${m[1]}${m[2]} ${m[3]}호`;

  m = compact.match(/^강원(\d{2})(자|배|바)(\d{4})호?$/);
  if (m) return `강원${m[1]}${m[2]} ${m[3]}호`;

  return raw.endsWith("호") ? raw : raw + "호";
}

function excelDateToTextV78(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const text = String(value).trim();
  const m = text.match(/(20\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return text;
}

function parseCurrent2026WorkbookV78(workbook: XLSX.WorkBook, sourceFile: string): SummaryRow[] {
  const sheetName = workbook.SheetNames.includes("2026년회비내역")
    ? "2026년회비내역"
    : workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: "" });
  if (matrix.length < 2) return [];

  const headers = (matrix[0] || []).map((h) => String(h || "").trim());
  const col = (name: string) => headers.findIndex((h) => h.replace(/\s+/g, "") === name.replace(/\s+/g, ""));

  const regionIdx = col("지역");
  const accountIdx = col("계정");
  const noteIdx = col("비고");
  const vehicleIdx = col("차량번호");
  const nameIdx = headers.findIndex((h) => h.replace(/\s+/g, "") === "성명");

  const monthCols: { month: number; unpaidIdx: number; paidIdx: number; dateIdx: number; chargeIdx: number }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const m = headers[i].match(/^(\d{1,2})월미수금$/);
    if (m) {
      const month = Number(m[1]);
      monthCols.push({ month, unpaidIdx: i, paidIdx: i - 2, dateIdx: i - 1, chargeIdx: i - 3 });
    }
  }

  const rows: SummaryRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] || [];
    const vehicleNo = normalizeVehicleFrom2026V78(line[vehicleIdx]);
    const name = compactNameV78(line[nameIdx]);
    if (!vehicleNo || !name) continue;

    const account = String(line[accountIdx] || "").trim();
    const region = String(line[regionIdx] || "").trim();
    const note = String(line[noteIdx] || "").trim();

    let latestMonth = "";
    let latestUnpaid = 0;
    let latestMonthNumber = 0;
    let monthlyAmount = account.includes("관리비") ? 5000 : 10000;
    let lastPaidDate = "";

    for (const mc of monthCols) {
      const rawUnpaid = line[mc.unpaidIdx];
      const rawCharge = line[mc.chargeIdx];
      const rawPaid = line[mc.paidIdx];
      const rawDate = line[mc.dateIdx];

      if (num(rawCharge) > 0) monthlyAmount = num(rawCharge) > 0 && num(rawCharge) <= 20000 ? num(rawCharge) : monthlyAmount;

      const hasUnpaidValue = rawUnpaid !== "" && rawUnpaid !== null && rawUnpaid !== undefined;
      if (hasUnpaidValue) {
        latestMonthNumber = mc.month;
        latestMonth = `2026-${String(mc.month).padStart(2, "0")}`;
        latestUnpaid = num(rawUnpaid);
      }

      if (num(rawPaid) > 0) {
        const dateText = excelDateToTextV78(rawDate);
        lastPaidDate = dateText || `2026-${String(mc.month).padStart(2, "0")}`;
      }
    }

    if (!latestMonth) continue;

    const positiveUnpaid = Math.max(0, latestUnpaid);
    const unpaidMonths = monthlyAmount > 0 ? Math.ceil(positiveUnpaid / monthlyAmount) : 0;

    rows.push({
      sourceFile,
      region,
      account,
      billingType: account,
      vehicleNo,
      name,
      note,
      billingStartMonth: "",
      latestMonth,
      historyCount: 0,
      totalUnpaid: positiveUnpaid,
      unpaidMonths,
      paidEventMonths: 0,
      paidTotalAmount: 0,
      lastPaidMonth: lastPaidDate,
      monthlyAmount,
    });
  }

  return rows;
}

async function handleFilesV78(files: FileList | File[]) {
  setStatus("파일 읽는 중...");

  let allSummaries: SummaryRow[] = [];
  let allMonthlies: MonthlyRow[] = [];

  for (const file of Array.from(files)) {
    if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xlsm")) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      allSummaries = allSummaries.concat(parseCurrent2026WorkbookV78(workbook, file.name));
      continue;
    }

    const oldSummaryCount = summaryRows.length;
    await handleFile(file);
    // 기존 handleFile은 state를 직접 바꾸므로, 단독 업로드 호환용으로 둔다.
    // 여러 파일 처리는 아래에서 ZIP/CSV만 단순 생략하지 않고 직접 재파싱하려면 별도 구현 필요.
  }

  if (allSummaries.length) {
    setSummaryRows((prev) => {
      const map = new Map<string, SummaryRow>();
      for (const row of prev) map.set(normalizeVehicle(row.vehicleNo) + "|" + row.name + "|" + (row.billingType || row.account || ""), row);
      for (const row of allSummaries) {
        const key = normalizeVehicle(row.vehicleNo) + "|" + row.name + "|" + (row.billingType || row.account || "");
        const old = map.get(key);
        map.set(key, { ...(old || {}), ...row, billingStartMonth: old?.billingStartMonth || row.billingStartMonth, historyCount: old?.historyCount || row.historyCount });
      }
      return Array.from(map.values());
    });
    setStatus(`2026 미수금 현재값 추출: ${allSummaries.length.toLocaleString("ko-KR")}명. 추출자료 저장을 누르세요.`);
  }
}

export default function PaymentHistory() {
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SummaryRow | null>(null);
  const [status, setStatus] = useState("");

  const dbSummaryQuery = trpc.billing.paymentHistorySummary.useQuery(undefined, { retry: false });
  const importSummaryMutation = trpc.billing.paymentHistoryImportSummaryRows.useMutation();
  const importRowsMutation = trpc.billing.paymentHistoryImportRows.useMutation();

  const displayRows = summaryRows.length ? summaryRows : ((dbSummaryQuery.data || []) as any[]).map((row) => ({
    sourceFile: "DB",
    region: row.region || "",
    account: row.billingType || "",
    billingType: row.billingType || "",
    vehicleNo: row.vehicleNo || "",
    name: row.name || "",
    billingStartMonth: row.billingStartMonth || "",
    latestMonth: row.latestMonth || "",
    historyCount: Number(row.historyCount || 0),
    totalUnpaid: Number(row.totalUnpaid || 0),
    unpaidMonths: Number(row.unpaidMonths || 0),
    lastPaidMonth: row.lastPaidMonth || "",
  }));

  const filteredRows = useMemo(() => {
    const q = search.trim();
    if (!q) return displayRows;
    return displayRows.filter((row) =>
      String(row.vehicleNo || "").includes(q) ||
      String(row.name || "").includes(q) ||
      String(row.region || "").includes(q)
    );
  }, [displayRows, search]);

  async function handleFile(file: File) {
    setStatus("파일 읽는 중...");
    setSummaryRows([]);
    setMonthlyRows([]);

    const summaries: SummaryRow[] = [];
    const monthlies: MonthlyRow[] = [];

    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

      const summaryName = names.find((name) => name.includes("요약") && name.toLowerCase().endsWith(".csv"));
      const monthlyName = names.find((name) => name.includes("프로그램업로드용") && name.toLowerCase().endsWith(".csv"));

      if (summaryName) {
        const text = await zip.files[summaryName].async("string");
        parseCsv(text).forEach((row) => {
          const parsed = summaryFromCsvRow(row, summaryName);
          if (parsed) summaries.push(parsed);
        });
      }

      if (monthlyName) {
        const text = await zip.files[monthlyName].async("string");
        parseCsv(text).forEach((row, index) => {
          const parsed = monthlyFromCsvRow(row, monthlyName, index);
          if (parsed) monthlies.push(parsed);
        });
      }
    } else {
      const text = await file.text();
      const rows = parseCsv(text);
      if (file.name.includes("요약")) {
        rows.forEach((row) => {
          const parsed = summaryFromCsvRow(row, file.name);
          if (parsed) summaries.push(parsed);
        });
      } else {
        rows.forEach((row, index) => {
          const parsed = monthlyFromCsvRow(row, file.name, index);
          if (parsed) monthlies.push(parsed);
        });
      }
    }

    setSummaryRows(summaries);
    setMonthlyRows(monthlies);
    setStatus(`추출: 월별 ${monthlies.length.toLocaleString("ko-KR")}건 / 요약 ${summaries.length.toLocaleString("ko-KR")}명`);
  }

  async function saveRows() {
    if (!summaryRows.length && !monthlyRows.length) {
      alert("저장할 자료가 없습니다.");
      return;
    }

    setStatus("DB 저장 중...");

    for (let i = 0; i < summaryRows.length; i += 1000) {
      await importSummaryMutation.mutateAsync({
        fileName: "현재2026기준_잔액변화납부추적_요약.csv",
        rows: summaryRows.slice(i, i + 1000),
      });
      setStatus(`요약 저장 중... ${Math.min(i + 1000, summaryRows.length).toLocaleString("ko-KR")} / ${summaryRows.length.toLocaleString("ko-KR")}`);
    }

    for (let i = 0; i < monthlyRows.length; i += 800) {
      await importRowsMutation.mutateAsync({
        fileName: "프로그램업로드용_잔액변화납부이력.csv",
        rows: monthlyRows.slice(i, i + 800),
      });
      setStatus(`월별 저장 중... ${Math.min(i + 800, monthlyRows.length).toLocaleString("ko-KR")} / ${monthlyRows.length.toLocaleString("ko-KR")}`);
    }

    await dbSummaryQuery.refetch();
    setStatus("DB 저장 완료. 이제 다음 달 부과대상/납부현황에서도 이 값이 보여야 합니다.");
  }

  const selectedMonthlyRows = selected
    ? monthlyRows.filter((row) => normalizeVehicle(row.vehicleNo) === normalizeVehicle(selected.vehicleNo) && row.name === selected.name)
    : [];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">납부이력 추적</h1>
        <div className="text-xs text-emerald-600 font-semibold mt-1">v78 2026 미수금 현재값 반영 화면</div>
        <p className="text-sm text-slate-500 mt-1">
          요약 CSV의 최근월말잔액/잔액있는월수를 미수금/미납발생개월수로 저장합니다.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="font-semibold mb-3">자료 업로드</div>
        <div className="flex gap-2 items-center">
          <label className="inline-flex cursor-pointer items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            엑셀/ZIP/CSV 선택
            <input
              type="file"
              className="hidden"
              accept=".zip,.csv,.xlsx,.xlsm" multiple
              onChange={(event) => { const files = event.target.files; if (files && files.length) handleFilesV78(files); }}
            />
          </label>
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
            disabled={!summaryRows.length && !monthlyRows.length}
            onClick={saveRows}
          >
            추출자료 저장
          </button>
          <span className="text-sm text-slate-600">{status}</span>
        </div>

        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          미수금 = 최근월말잔액, 미납발생개월수 = 잔액있는월수, 최근납부일 = 추정마지막납부월
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="font-semibold mb-3">납부이력 요약</div>
        <input
          className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
          placeholder="차량번호/성명/지역 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-2 py-2">차량번호</th>
                <th className="px-2 py-2">성명</th>
                <th className="px-2 py-2">지역</th>
                <th className="px-2 py-2">부과항목</th>
                <th className="px-2 py-2">부과시작월</th>
                <th className="px-2 py-2 text-right">부과개월수</th>
                <th className="px-2 py-2 text-right">미납발생개월수</th>
                <th className="px-2 py-2 text-right">미수금</th>
                <th className="px-2 py-2">최근납부일</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={index} className="border-b hover:bg-slate-50">
                  <td className="px-2 py-2">
                    <button className="font-mono font-semibold text-blue-700 underline" onClick={() => setSelected(row)}>
                      {row.vehicleNo}
                    </button>
                  </td>
                  <td className="px-2 py-2">{row.name}</td>
                  <td className="px-2 py-2">{row.region || "-"}</td>
                  <td className="px-2 py-2">{row.billingType || row.account || "-"}</td>
                  <td className="px-2 py-2">{row.billingStartMonth || "-"}</td>
                  <td className="px-2 py-2 text-right">{Number(row.historyCount || 0).toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-2 text-right">{Number(row.unpaidMonths || 0).toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-2 text-right font-semibold text-red-600">{money(row.totalUnpaid)}</td>
                  <td className="px-2 py-2">{row.lastPaidMonth || "-"}</td>
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={9} className="px-2 py-8 text-center text-slate-500">
                    납부이력 자료가 없습니다. ZIP 또는 CSV를 업로드 후 저장해 주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="max-h-[80vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">{selected.vehicleNo} {selected.name} 월별 상세</div>
              <button className="rounded-md border px-3 py-1 text-sm" onClick={() => setSelected(null)}>닫기</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-2 py-2">부과월</th>
                  <th className="px-2 py-2 text-right">월부과액</th>
                  <th className="px-2 py-2 text-right">잔액감소(추정)</th>
                  <th className="px-2 py-2 text-right">당월잔액</th>
                  <th className="px-2 py-2">원본파일</th>
                  <th className="px-2 py-2">비고</th>
                </tr>
              </thead>
              <tbody>
                {selectedMonthlyRows.map((row, index) => (
                  <tr key={index} className="border-b">
                    <td className="px-2 py-2">{row.billingMonth}</td>
                    <td className="px-2 py-2 text-right">{money(row.expectedAmount)}</td>
                    <td className="px-2 py-2 text-right">{money(row.paidAmount)}</td>
                    <td className="px-2 py-2 text-right">{money(row.unpaidAmount)}</td>
                    <td className="px-2 py-2">{row.sourceFile}</td>
                    <td className="px-2 py-2">{row.memo || "-"}</td>
                  </tr>
                ))}
                {!selectedMonthlyRows.length && (
                  <tr>
                    <td colSpan={6} className="px-2 py-8 text-center text-slate-500">
                      현재 화면에 월별 상세가 없습니다. 같은 ZIP을 다시 올리면 상세 확인이 가능합니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

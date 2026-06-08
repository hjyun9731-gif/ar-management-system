import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

type ArrearsRow = {
  vehicleNo?: string;
  name?: string;
  region?: string;
  billingType?: string;
  billingStartMonth?: string;
  arrearsStartMonth?: string | null;
  arrearsMonths?: number;
  arrearsAmount?: number;
  recentPaymentMonth?: string | null;
  latestMonth?: string | null;
};

function money(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("ko-KR") + "원" : "0원";
}

export default function BillingRecords() {
  const [search, setSearch] = useState("");
  const query = trpc.billing.paymentHistoryCurrentArrears.useQuery(undefined, {
    retry: false,
  });

  const rows = (query.data || []) as ArrearsRow[];

  const filteredRows = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    return rows.filter((row) =>
      String(row.vehicleNo || "").includes(q) ||
      String(row.name || "").includes(q) ||
      String(row.region || "").includes(q) ||
      String(row.billingType || "").includes(q)
    );
  }, [rows, search]);

  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.arrearsAmount || 0), 0),
    [rows]
  );

  const arrearsPeople = useMemo(
    () => rows.filter((row) => Number(row.arrearsAmount || 0) > 0).length,
    [rows]
  );

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">납부현황</h1>
        <div className="text-xs text-emerald-600 font-semibold mt-1">v71 납부현황 안정화 화면</div>
        <p className="text-sm text-slate-500 mt-1">
          과거 납부이력 DB 기준으로 부과시작월, 미납시작월, 미납개월수, 미수금, 최근납부일을 조회합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">납부이력 등록자</div>
          <div className="text-2xl font-bold mt-1">{rows.length.toLocaleString("ko-KR")}명</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">미수금 있는 사람</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{arrearsPeople.toLocaleString("ko-KR")}명</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">현재 미수금 합계</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{money(totalAmount)}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <div className="font-semibold text-slate-900">납부이력 연동 요약</div>
            <div className="text-xs text-slate-500 mt-1">
              ZIP 업로드 후 추출자료 저장이 완료된 DB 자료를 기준으로 표시합니다.
            </div>
          </div>
          <div className="flex gap-2">
            <input
              className="border rounded-md px-3 py-2 text-sm w-64"
              placeholder="차량번호/성명/지역/부과항목 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => { window.location.href = "/payment-history"; }}
            >
              납부이력 상세
            </button>
          </div>
        </div>

        {query.isError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            납부이력 조회 중 오류가 발생했습니다: {query.error.message}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-2 py-2">차량번호</th>
                <th className="px-2 py-2">성명</th>
                <th className="px-2 py-2">지역</th>
                <th className="px-2 py-2">부과항목</th>
                <th className="px-2 py-2">부과시작월</th>
                <th className="px-2 py-2">미납시작월</th>
                <th className="px-2 py-2 text-right">미납개월수</th>
                <th className="px-2 py-2 text-right">미수금</th>
                <th className="px-2 py-2">최근납부일</th>
                <th className="px-2 py-2 text-center">상세</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading && (
                <tr>
                  <td colSpan={10} className="px-2 py-8 text-center text-slate-500">
                    납부이력 자료를 불러오는 중입니다.
                  </td>
                </tr>
              )}

              {!query.isLoading && filteredRows.map((row, index) => (
                <tr key={index} className="border-b hover:bg-slate-50">
                  <td className="px-2 py-2 font-mono font-semibold">{row.vehicleNo || "-"}</td>
                  <td className="px-2 py-2">{row.name || "-"}</td>
                  <td className="px-2 py-2">{row.region || "-"}</td>
                  <td className="px-2 py-2">{row.billingType || "-"}</td>
                  <td className="px-2 py-2">{row.billingStartMonth || "-"}</td>
                  <td className="px-2 py-2">{row.arrearsStartMonth || "-"}</td>
                  <td className="px-2 py-2 text-right">{Number(row.arrearsMonths || 0).toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-2 text-right font-semibold text-red-600">{money(row.arrearsAmount)}</td>
                  <td className="px-2 py-2">{row.recentPaymentMonth || "-"}</td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={() => { window.location.href = "/payment-history"; }}
                    >
                      보기
                    </button>
                  </td>
                </tr>
              ))}

              {!query.isLoading && !filteredRows.length && (
                <tr>
                  <td colSpan={10} className="px-2 py-8 text-center text-slate-500">
                    납부이력 DB 자료가 없습니다. 납부이력 추적 화면에서 ZIP 업로드 후 추출자료 저장을 먼저 진행하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

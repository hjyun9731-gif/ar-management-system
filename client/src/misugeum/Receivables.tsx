// 미수금 명단 — 조회·필터·검색·수납처리 (Genspark 기능 이식: 원장미수/수납합계/현재잔액/미수개월수)
import React from 'react';
import { DSCard, DSIcon } from './ds';
import {
  StatusPill, ChargeTag, AccountingTag, MonthsChip, MemberStatusChip,
  SearchBox, DownloadBtn, Chip,
} from './ui';
import {
  won, num, outstanding, arrearsMonths, paidTotal, ledgerArrears,
  basisYm, billingBasisDate, payStatus, isExcludedStatus, REGIONS, INCOME_ITEMS,
} from './data';
import type { Member } from './data';
import { PayModal, MemberDetail, ClosureModal } from './Modals';

// ===== FilterDropdown =====
export function FilterDropdown({
  label,
  value,
  onChange,
  options,
  render,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  render: (v: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const active = !!value && value !== "정상";
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 12px 0 14px",
          borderRadius: "var(--radius-pill)", cursor: "pointer", whiteSpace: "nowrap",
          border: active ? "1px solid var(--brand)" : "1px solid var(--border-default)",
          background: active ? "var(--brand-subtle)" : "var(--white)",
          color: active ? "var(--brand-active)" : "var(--text-secondary)",
          font: "var(--fw-medium) 13px/1 var(--font-sans)",
        }}
      >
        {render(value)}
        <DSIcon name="chevron-down" size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: 42, left: 0, zIndex: 20, minWidth: 150, maxHeight: 300, overflow: "auto",
            background: "var(--white)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)", padding: 6,
          }}
        >
          {options.map((o) => (
            <button
              key={o || "all"}
              type="button"
              onClick={() => { onChange(o); setOpen(false); }}
              style={{
                display: "flex", width: "100%", textAlign: "left", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
                background: o === value ? "var(--brand-subtle)" : "transparent",
                color: o === value ? "var(--brand-active)" : "var(--text-primary)",
                font: "var(--fw-medium) 13px/1 var(--font-sans)",
              }}
              onMouseEnter={(e) => { if (o !== value) e.currentTarget.style.background = "var(--grey-25)"; }}
              onMouseLeave={(e) => { if (o !== value) e.currentTarget.style.background = "transparent"; }}
            >
              {render(o)}
              {o === value && <DSIcon name="check" size={13} style={{ color: "var(--brand)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Receivables =====
export function Receivables({
  members,
  drill,
  density,
  onPay,
  onSelect,
  onClose,
  onToast,
}: {
  members: Member[];
  drill: any;
  density?: string;
  onPay: (m: Member) => void;
  onSelect: (m: Member) => void;
  onClose?: () => void;
  onToast?: (msg: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [membership, setMembership] = React.useState("");   // 협회가입/협회미가입
  const [account, setAccount] = React.useState("");         // 협회비/관리비
  const [amount, setAmount] = React.useState("전체");        // 전체/미수있음/완납/선납/30만원이상
  const [status, setStatus] = React.useState("정상");
  const [special, setSpecial] = React.useState("");         // 장기/결번/자격/70세
  const [sort, setSort] = React.useState<{ key: string; dir: string }>({ key: "outstanding", dir: "desc" });

  // 대시보드 드릴다운 반영
  React.useEffect(() => {
    if (!drill) return;
    setAmount(drill.amount || "전체");
    setRegion(drill.region || "");
    setSpecial(drill.special || "");
    setStatus(drill.status || "정상");
    setMembership(""); setAccount(""); setQuery("");
  }, [drill]);

  const rows = React.useMemo(() => {
    const q = query.trim();
    const nq = (q as any);
    let list = members.filter((m) => {
      if (status !== "전체" && m.status !== status) return false;
      const out = outstanding(m);
      if (amount === "미수있음" && !(out > 0)) return false;
      if (amount === "완납" && out !== 0) return false;
      if (amount === "선납" && !(out < 0)) return false;
      if (amount === "30만원이상" && !(out >= 300000)) return false;
      if (region && m.sigun !== region) return false;
      if (membership && m.membership !== membership) return false;
      if (account && m.chargeItem !== account) return false;
      if (special === "장기" && arrearsMonths(m) < 12) return false;
      if (special === "결번" && !m.disconnected) return false;
      if (special === "자격" && !m.certMissing) return false;
      if (special === "70세" && !m.isSenior) return false;
      if (q) {
        const text = [m.name, m.vehicleNo, m.id, m.mgmtNo, m.phone, m.sigun, m.regionRaw, m.address, m.note].join(" ").toLowerCase();
        const hit = text.includes(q.toLowerCase());
        if (!hit) return false;
      }
      return true;
    });
    const dir = sort.dir === "desc" ? -1 : 1;
    const val = (m: Member): any => {
      switch (sort.key) {
        case "outstanding": return outstanding(m);
        case "months": return arrearsMonths(m);
        case "ledger": return ledgerArrears(m);
        case "region": return (REGIONS as string[]).indexOf(m.sigun);
        case "name": return m.name;
        case "vehicle": return m.vehicleNo;
        default: return outstanding(m);
      }
    };
    list.sort((a, b) => {
      const av = val(a), bv = val(b);
      if (typeof av === "string") return av.localeCompare(bv, "ko") * dir;
      return (av - bv) * dir;
    });
    return list;
  }, [members, query, region, membership, account, amount, status, special, sort]);

  const sumOut = rows.reduce((s, m) => s + outstanding(m), 0);
  const over300 = rows.filter((m) => outstanding(m) >= 300000).length;
  const longCnt = rows.filter((m) => arrearsMonths(m) >= 12).length;
  const pad = density === "compact" ? "9px 14px" : density === "comfy" ? "16px 14px" : "12px 14px";

  const PAY_TABS: [string, string][] = [["전체", "전체"], ["미수있음", "미납"], ["완납", "완납/0원"], ["선납", "선납/초과"], ["30만원이상", "30만원↑"]];
  const countByAmount = (key: string) =>
    members.filter((m) => {
      if (status !== "전체" && m.status !== "정상") return false;
      const out = outstanding(m);
      if (key === "전체") return true;
      if (key === "미수있음") return out > 0;
      if (key === "완납") return out === 0;
      if (key === "선납") return out < 0;
      if (key === "30만원이상") return out >= 300000;
      return true;
    }).length;

  function resetFilters() {
    setQuery(""); setRegion(""); setMembership(""); setAccount("");
    setAmount("전체"); setStatus("정상"); setSpecial("");
    setSort({ key: "outstanding", dir: "desc" });
  }

  function exportCSV() {
    const head = ["지역", "차량번호", "이름", "계정", "부과기준일", "기준월", "미수개월수", "원장미수", "수납합계", "현재잔액", "핸드폰번호", "주소", "처리상태"];
    const lines = [head.join(",")].concat(
      rows.map((m) =>
        [
          m.sigun, m.vehicleNo, m.name, m.chargeItem, billingBasisDate(m), basisYm(m), arrearsMonths(m),
          ledgerArrears(m), paidTotal(m), outstanding(m), m.phone || "-", m.address, m.status,
        ]
          .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    link.download = "미수금명단.csv";
    link.click();
    onToast && onToast(`미수금명단 엑셀 다운로드 완료 · ${rows.length}명`);
  }

  const SortTh = ({ label, k, align = "left" }: { label: string; k: string; align?: string }) => (
    <th
      onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}
      style={{
        textAlign: align as any, padding: "11px 14px", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
        font: "var(--fw-demibold) 12px/1 var(--font-sans)", color: "var(--text-tertiary)",
        background: "var(--grey-25)", borderBottom: "1px solid var(--border-default)", position: "sticky", top: 0, zIndex: 1,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {sort.key === k && <DSIcon name={sort.dir === "desc" ? "chevron-down" : "chevron-up"} size={11} style={{ color: "var(--brand)" }} />}
      </span>
    </th>
  );

  const Th = ({ label, align = "left" }: { label: string; align?: string }) => (
    <th
      style={{
        textAlign: align as any, padding: "11px 14px", whiteSpace: "nowrap",
        font: "var(--fw-demibold) 12px/1 var(--font-sans)", color: "var(--text-tertiary)",
        background: "var(--grey-25)", borderBottom: "1px solid var(--border-default)", position: "sticky", top: 0, zIndex: 1,
      }}
    >
      {label}
    </th>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 요약 스트립 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {([
          ["검색 결과", `${num(rows.length)}명`, "var(--text-primary)"],
          ["현재잔액 합계", won(sumOut), "var(--red-500)"],
          ["30만원 이상", `${num(over300)}명`, "var(--text-primary)"],
          ["12개월 이상", `${num(longCnt)}명`, "#B9791A"],
        ] as [string, string, string][]).map(([l, v, c]) => (
          <div
            key={l}
            style={{ background: "var(--white)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "14px 18px", boxShadow: "var(--shadow-xs)" }}
          >
            <div style={{ font: "var(--body-xs)", color: "var(--text-tertiary)" }}>{l}</div>
            <div style={{ font: "var(--fw-bold) 20px/1.1 var(--font-sans)", color: c, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* 금액 탭 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PAY_TABS.map(([key, label]) => (
          <Chip key={key} active={amount === key} count={countByAmount(key)} onClick={() => setAmount(key)}>{label}</Chip>
        ))}
      </div>

      {/* 필터줄 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <FilterDropdown label="지역" value={region} onChange={setRegion} options={["", ...(REGIONS as string[])]} render={(v) => v || "전체 지역"} />
        <FilterDropdown label="가입" value={membership} onChange={setMembership} options={["", "협회가입", "협회미가입"]} render={(v) => v || "가입/미가입"} />
        <FilterDropdown label="계정" value={account} onChange={setAccount} options={["", "협회비", "관리비"]} render={(v) => v || "계정 전체"} />
        <FilterDropdown label="상태" value={status} onChange={setStatus} options={["정상", "전체", "폐업", "양도", "이관", "탈퇴"]} render={(v) => v === "전체" ? "상태 전체" : v} />
        <DivLine />
        <Chip active={special === "장기"} onClick={() => setSpecial(special === "장기" ? "" : "장기")}>12개월 이상</Chip>
        <Chip active={special === "70세"} onClick={() => setSpecial(special === "70세" ? "" : "70세")}>70세</Chip>
        <Chip active={special === "결번"} onClick={() => setSpecial(special === "결번" ? "" : "결번")}>결번/반송</Chip>
        <Chip active={special === "자격"} onClick={() => setSpecial(special === "자격" ? "" : "자격")}>자격증명 미발급</Chip>
        <button
          type="button"
          onClick={resetFilters}
          style={{ marginLeft: "auto", height: 36, padding: "0 14px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border-default)", background: "var(--white)", cursor: "pointer", color: "var(--text-secondary)", font: "var(--fw-medium) 13px/1 var(--font-sans)" }}
        >
          초기화
        </button>
      </div>

      {/* 검색 + 정렬 + 다운로드 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SearchBox value={query} onChange={setQuery} width={360} placeholder="이름 · 차량번호(뒤4자리) · 관리번호 · 전화번호 · 주소 검색" />
          <SortSelect sort={sort} onChange={setSort} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ font: "var(--body-sm)", color: "var(--text-secondary)" }}>미수 합계 <b style={{ color: "var(--red-500)" }}>{won(sumOut)}</b></span>
          <DownloadBtn onClick={exportCSV} />
        </div>
      </div>

      {/* 테이블 */}
      <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--white)", boxShadow: "var(--shadow-xs)" }}>
        <div style={{ maxHeight: "calc(100vh - 430px)", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
            <thead>
              <tr>
                <Th label="지역" /><Th label="차량번호" /><SortTh label="이름" k="name" /><Th label="계정" />
                <Th label="기준월" /><SortTh label="미수개월" k="months" align="left" />
                <SortTh label="원장미수" k="ledger" align="right" /><Th label="수납합계" align="right" />
                <SortTh label="현재잔액" k="outstanding" align="right" /><Th label="전화번호" />
                <Th label="처리상태" /><Th label="최근수납" /><Th label="" align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const out = outstanding(m);
                const recent = (m.payments || [])[0];
                return (
                  <tr
                    key={m.id}
                    onClick={() => onSelect(m)}
                    style={{ cursor: "pointer", borderBottom: "1px solid var(--border-subtle)", transition: "background .12s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--grey-25)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: pad, font: "var(--body-sm)", color: "var(--text-primary)", whiteSpace: "nowrap" }}>{m.sigun}</td>
                    <td style={{ padding: pad, font: "var(--body-sm)", color: "var(--text-secondary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{m.vehicleNo}</td>
                    <td style={{ padding: pad, whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <b style={{ font: "var(--fw-demibold) 14px/1 var(--font-sans)", color: "var(--text-primary)" }}>{m.name}</b>
                        {m.isSenior && (
                          <span style={{ font: "10px/1 var(--font-sans)", color: "var(--green-500)", fontWeight: 700, padding: "2px 5px", background: "#EAF7F0", borderRadius: 4 }}>70세</span>
                        )}
                        <MemberStatusChip status={m.status} />
                      </span>
                    </td>
                    <td style={{ padding: pad }}><ChargeTag item={m.chargeItem} /></td>
                    <td style={{ padding: pad, font: "var(--body-sm)", color: "var(--text-tertiary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{basisYm(m)}</td>
                    <td style={{ padding: pad }}><MonthsChip months={arrearsMonths(m)} /></td>
                    <td style={{ padding: pad, textAlign: "right", font: "var(--body-sm)", color: "var(--text-secondary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{won(ledgerArrears(m))}</td>
                    <td style={{ padding: pad, textAlign: "right", font: "var(--body-sm)", color: "var(--green-500)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{paidTotal(m) ? won(paidTotal(m)) : "—"}</td>
                    <td style={{
                      padding: pad, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
                      font: "var(--fw-bold) 14px/1 var(--font-sans)",
                      color: out > 0 ? "var(--red-500)" : out < 0 ? "var(--violet-500)" : "var(--text-tertiary)",
                    }}>
                      {won(out)}
                    </td>
                    <td style={{ padding: pad, font: "var(--body-sm)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: m.disconnected ? "var(--red-500)" : "var(--text-secondary)" }}>
                      {m.phone || "—"}
                    </td>
                    <td style={{ padding: pad }}>
                      {out < 0 ? <StatusPill status="선납" /> : out === 0 ? <StatusPill status="완납" /> :
                        m.status === "정상" ? <StatusPill status="미납" /> : <MemberStatusChip status={m.status} />}
                    </td>
                    <td style={{ padding: pad, font: "var(--body-xs)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                      {recent ? `${recent.paidDate} · ${won(recent.amount)}` : "—"}
                    </td>
                    <td style={{ padding: pad, textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onPay(m); }}
                        style={{
                          height: 30, padding: "0 13px", borderRadius: "var(--radius-pill)", whiteSpace: "nowrap",
                          border: "1px solid var(--border-default)", cursor: "pointer", background: "var(--white)", color: "var(--brand)",
                          font: "var(--fw-demibold) 12px/1 var(--font-sans)", transition: "all .12s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--brand)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--brand)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--white)"; e.currentTarget.style.color = "var(--brand)"; e.currentTarget.style.borderColor = "var(--border-default)"; }}
                      >
                        수납
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} style={{ padding: "60px", textAlign: "center", color: "var(--text-tertiary)", font: "var(--body-md)" }}>조건에 맞는 회원이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid var(--border-subtle)", background: "var(--grey-25)" }}>
          <span style={{ font: "var(--body-xs)", color: "var(--text-tertiary)" }}>이름 클릭 시 상세 · 0원·선납 회원도 함께 표시 (협회 관리 대상 전체 명단)</span>
          <span style={{ font: "var(--fw-medium) 13px/1 var(--font-sans)", color: "var(--text-secondary)" }}>{num(rows.length)}명</span>
        </div>
      </div>
    </div>
  );
}

function DivLine() {
  return <span style={{ width: 1, height: 20, background: "var(--border-default)", margin: "0 2px" }} />;
}

function SortSelect({ sort, onChange }: { sort: { key: string; dir: string }; onChange: (s: { key: string; dir: string }) => void }) {
  const opts: [string, string, string][] = [
    ["outstanding", "desc", "미납금액순"],
    ["months", "desc", "미수개월수순"],
    ["ledger", "desc", "원장미수순"],
    ["region", "asc", "지역순"],
    ["vehicle", "asc", "차량번호순"],
    ["name", "asc", "이름순"],
  ];
  const val = `${sort.key}:${sort.dir}`;
  return (
    <select
      value={val}
      onChange={(e) => { const [key, dir] = e.target.value.split(":"); onChange({ key, dir }); }}
      style={{
        appearance: "none", height: 42, padding: "0 32px 0 14px", borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-default)", background: "var(--white)", cursor: "pointer",
        font: "var(--fw-medium) 13px/1 var(--font-sans)", color: "var(--text-primary)",
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 6 12' fill='%239096A2'><path d='M0 4l3 4 3-4'/></svg>\")",
        backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
      }}
    >
      {opts.map(([k, d, l]) => (
        <option key={k} value={`${k}:${d}`}>{l}</option>
      ))}
    </select>
  );
}

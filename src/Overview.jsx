import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, LabelList,
} from "recharts";
import KpiCard from "./components/KpiCard.jsx";
import {
  computeKpis, dailyRevenue, withMovingAverage, revenueByBranch,
  fmtBaht, fmtBaht2, fmtNum, fmtShortBaht,
} from "./lib/metrics.js";
import { addDays } from "./lab3/time.js";

// สีกราฟโทนเขียวมิ้น ต้องตรงกับ --color-mint-* ใน src/index.css (Recharts รับสีเป็นค่า SVG จึงใช้ class ไม่ได้)
export const BRAND = "#157a62"; // เขียวมิ้นเข้ม: หัวข้อ เส้นค่าเฉลี่ย แท่งสาขา
export const ACCENT = "#3cc4a2"; // เขียวมิ้นสว่าง: เส้นยอดรายวัน (จาง)
const GRID = "#e1efe9";
const TICK = { fontSize: 12, fill: "#5d7d72" };

export const thaiDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
// ช่วงลัด นับย้อนจากวันล่าสุดของข้อมูล (ไม่ใช่วันนี้) รวมวันสุดท้าย
const PRESETS = [
  { id: "30", label: "30 วัน", days: 30 },
  { id: "90", label: "90 วัน", days: 90 },
  { id: "all", label: "ทั้งหมด", days: null },
];

const inputClass =
  "mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-mint-500";

export default function Overview({ rows }) {
  const bounds = useMemo(() => {
    let min = "", max = "";
    for (const r of rows) {
      if (!min || r.date < min) min = r.date;
      if (r.date > max) max = r.date;
    }
    return { min, max };
  }, [rows]);

  const [branch, setBranch] = useState("");
  const [start, setStart] = useState(bounds.min);
  const [end, setEnd] = useState(bounds.max);

  const presetStart = (p) => (p.days ? addDays(bounds.max, -(p.days - 1)) : bounds.min);
  const activePreset = PRESETS.find((p) => end === bounds.max && start === presetStart(p))?.id;
  const isDefault = !branch && start === bounds.min && end === bounds.max;

  const choosePreset = (p) => { setStart(presetStart(p)); setEnd(bounds.max); };
  const reset = () => { setBranch(""); setStart(bounds.min); setEnd(bounds.max); };

  const data = useMemo(() => {
    const inRange = (r) => r.date >= start && r.date <= end;
    const branchRows = branch ? rows.filter((r) => r.branch === branch) : rows;
    const filtered = branchRows.filter(inRange);
    return {
      count: filtered.length,
      kpis: computeKpis(filtered),
      // ค่าเฉลี่ย 7 วันคำนวณจากทั้งช่วงก่อน แล้วค่อยตัดเฉพาะช่วงที่เลือก วันแรกของช่วงจึงยังมีค่าเฉลี่ย
      daily: withMovingAverage(dailyRevenue(branchRows)).filter((d) => d.date >= start && d.date <= end),
      // กราฟสาขากรองแค่วันที่ เพื่อยังเทียบกับสาขาอื่นได้ แล้วไฮไลต์สาขาที่เลือก
      branches: revenueByBranch(rows.filter(inRange)),
    };
  }, [rows, branch, start, end]);

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold" style={{ color: BRAND }}>ภาพรวมยอดขาย</h1>
        <p className="text-stone-500">
          {branch || "ทุกสาขา"} · {thaiDate(start)} – {thaiDate(end)} · {fmtNum(data.count)} รายการ
        </p>
      </header>

      <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <label className="block text-sm">
            <span className="text-stone-500">สาขา</span>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className={inputClass}>
              <option value="">ทุกสาขา</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-stone-500">ตั้งแต่วันที่</span>
            <input type="date" value={start} min={bounds.min} max={end}
                   onChange={(e) => e.target.value && setStart(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="text-stone-500">ถึงวันที่</span>
            <input type="date" value={end} min={start} max={bounds.max}
                   onChange={(e) => e.target.value && setEnd(e.target.value)} className={inputClass} />
          </label>
          <button onClick={reset} disabled={isDefault}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-mint-700 ring-1 ring-mint-100 hover:bg-mint-50 disabled:cursor-default disabled:text-stone-300 disabled:ring-stone-100 disabled:hover:bg-transparent">
            ล้างตัวกรอง
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">ช่วงลัด:</span>
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => choosePreset(p)}
                    className={`rounded-full px-3 py-1 font-medium ${activePreset === p.id ? "bg-mint-700 text-white" : "bg-mint-50 text-mint-700 hover:bg-mint-100"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {data.count === 0 ? (
        <p className="rounded-xl bg-white px-6 py-12 text-center text-stone-500 ring-1 ring-stone-200">
          ไม่มียอดขายตามตัวกรองที่เลือก ลองเปลี่ยนสาขาหรือขยายช่วงวันที่
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="ยอดขายรวม" value={fmtBaht(kpis.revenue)} highlight />
            <KpiCard label="จำนวนบิล" value={fmtNum(kpis.bills)} />
            <KpiCard label="ยอดเฉลี่ยต่อบิล" value={fmtBaht2(kpis.avgPerBill)} />
            <KpiCard label="ลูกค้าสมาชิก" value={fmtNum(kpis.customers)} note="ไม่นับลูกค้า walk-in" />
          </section>

          <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
            <h2 className="text-lg font-semibold">ยอดขายรายวัน</h2>
            <p className="mb-3 text-sm text-stone-500">เส้นจาง = ยอดจริงรายวัน · เส้นเข้ม = ค่าเฉลี่ย 7 วัน</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={thaiDate} minTickGap={40} tick={TICK} stroke={GRID} />
                  <YAxis tickFormatter={fmtShortBaht} width={60} tick={TICK} stroke={GRID} />
                  <Tooltip
                    labelFormatter={thaiDate}
                    formatter={(v, name) => [fmtBaht(v), name === "ma" ? "เฉลี่ย 7 วัน" : "ยอดขาย"]}
                  />
                  <Line dataKey="revenue" stroke={ACCENT} strokeOpacity={0.45} dot={false} strokeWidth={1} isAnimationActive={false} />
                  <Line dataKey="ma" stroke={BRAND} dot={false} strokeWidth={2.5} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
            <h2 className="text-lg font-semibold">ยอดขายแยกสาขา</h2>
            <p className="mb-3 text-sm text-stone-500">
              {branch ? `ไฮไลต์สาขา${branch} เทียบกับสาขาอื่นในช่วงเดียวกัน` : "สาขาอารีย์เพิ่งเปิดเมื่อ 1 พ.ย. 68 ยอดรวมจึงน้อยกว่าสาขาอื่น"}
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.branches} layout="vertical" margin={{ top: 5, right: 80, left: 10, bottom: 5 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtShortBaht} tick={TICK} stroke={GRID} />
                  <YAxis type="category" dataKey="branch" width={90} tick={{ ...TICK, fontSize: 14, fill: "#12332b" }} stroke={GRID} />
                  <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขาย"]} cursor={{ fill: "#e9f6f1" }} />
                  <Bar dataKey="revenue" fill={BRAND} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {data.branches.map((b) => (
                      <Cell key={b.branch} fillOpacity={!branch || b.branch === branch ? 1 : 0.25} />
                    ))}
                    <LabelList dataKey="revenue" position="right" formatter={fmtBaht} style={{ fontSize: 12, fill: "#35524a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

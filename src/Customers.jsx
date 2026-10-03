// แท็บลูกค้า: ข้อมูลสมาชิกจาก public/customers.csv (customers_clean.csv จากการบ้าน Lab 2)
// คำนวณทั้งหมดอยู่ใน src/lib/customerMetrics.js ไฟล์นี้มีแค่ UI
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import KpiCard from "./components/KpiCard.jsx";
import {
  AGE_GROUPS, customerKpis, joinsByMonth, membersByAge, membersByBranch, membersByGender, topSpenders,
} from "./lib/customerMetrics.js";
import { fmtBaht, fmtNum } from "./lib/metrics.js";
import { thaiMonth } from "./lab2/lab2Metrics.js";
import { BRAND, ACCENT, thaiDate } from "./Overview.jsx";

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
const STATUSES = [
  { id: "", label: "ทุกสถานะ" },
  { id: "active", label: "ยังใช้งาน" },
  { id: "inactive", label: "ไม่ใช้งาน" },
];
const GRID = "#e1efe9";
const TICK = { fontSize: 12, fill: "#5d7d72" };
const PAGE = 20;
const pct = (x) => `${(x * 100).toFixed(1)}%`;

const inputClass =
  "mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-mint-500";

export default function Customers({ customers }) {
  const [branch, setBranch] = useState("");
  const [age, setAge] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);

  const isDefault = !branch && !age && !status && !search;
  const reset = () => { setBranch(""); setAge(""); setStatus(""); setSearch(""); setShown(PAGE); };
  const change = (setter) => (e) => { setter(e.target.value); setShown(PAGE); };

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = customers.filter((c) =>
      (!branch || c.home_branch === branch) &&
      (!age || c.age_group === age) &&
      (!status || c.is_active === (status === "active")) &&
      (!q || c.customer_id.toLowerCase().includes(q) || c.nickname.toLowerCase().includes(q)),
    );
    return {
      list,
      kpis: customerKpis(list),
      months: joinsByMonth(list),
      ages: membersByAge(list),
      branches: membersByBranch(list),
      genders: membersByGender(list),
      ranked: topSpenders(list, list.length),
    };
  }, [customers, branch, age, status, search]);

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold" style={{ color: BRAND }}>ลูกค้าสมาชิก</h1>
        <p className="text-stone-500">
          {fmtNum(data.list.length)} จาก {fmtNum(customers.length)} คน
          {branch && ` · สาขาประจำ${branch}`}{age && ` · อายุ ${age}`}
        </p>
      </header>

      <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.3fr_auto] lg:items-end">
          <label className="block text-sm">
            <span className="text-stone-500">สาขาประจำ</span>
            <select value={branch} onChange={change(setBranch)} className={inputClass}>
              <option value="">ทุกสาขา</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-stone-500">กลุ่มอายุ</span>
            <select value={age} onChange={change(setAge)} className={inputClass}>
              <option value="">ทุกช่วงอายุ</option>
              {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-stone-500">สถานะ</span>
            <select value={status} onChange={change(setStatus)} className={inputClass}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-stone-500">ค้นหา</span>
            <input type="search" value={search} onChange={change(setSearch)} placeholder="รหัสสมาชิก หรือ ชื่อเล่น" className={inputClass} />
          </label>
          <button onClick={reset} disabled={isDefault}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-mint-700 ring-1 ring-mint-100 hover:bg-mint-50 disabled:cursor-default disabled:text-stone-300 disabled:ring-stone-100 disabled:hover:bg-transparent">
            ล้างตัวกรอง
          </button>
        </div>
      </section>

      {data.list.length === 0 ? (
        <p className="rounded-xl bg-white px-6 py-12 text-center text-stone-500 ring-1 ring-stone-200">
          ไม่พบสมาชิกตามตัวกรองที่เลือก ลองเปลี่ยนตัวกรองหรือคำค้นหา
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="สมาชิก" value={fmtNum(kpis.members)} highlight />
            <KpiCard label="ยังใช้งานอยู่" value={pct(kpis.activeRate)} note={`${fmtNum(kpis.active)} คน`} />
            <KpiCard label="เคยซื้อแล้ว" value={fmtNum(kpis.buyers)} note={`ยังไม่เคยซื้อ ${fmtNum(kpis.members - kpis.buyers)} คน`} />
            <KpiCard label="ใช้จ่ายเฉลี่ยต่อคน" value={fmtBaht(kpis.avgSpend)} note={`เฉลี่ย ${kpis.avgOrders.toFixed(1)} บิล · เฉพาะคนที่เคยซื้อ`} />
          </section>

          <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
            <h2 className="text-lg font-semibold">สมาชิกใหม่รายเดือน</h2>
            <p className="mb-3 text-sm text-stone-500">นับตามเดือนที่สมัคร (joined_month)</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.months} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="month" tickFormatter={thaiMonth} tick={TICK} stroke={GRID} interval="preserveStartEnd" minTickGap={10} />
                  <YAxis tick={TICK} stroke={GRID} width={40} allowDecimals={false} />
                  <Tooltip labelFormatter={thaiMonth} formatter={(v) => [`${fmtNum(v)} คน`, "สมาชิกใหม่"]} cursor={{ fill: "#e9f6f1" }} />
                  <Bar dataKey="members" fill={BRAND} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="members" position="top" style={{ fontSize: 11, fill: "#35524a" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
              <h2 className="mb-3 text-lg font-semibold">กลุ่มอายุ</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ages} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" tick={TICK} stroke={GRID} allowDecimals={false} />
                    <YAxis type="category" dataKey="age_group" width={80} tick={{ ...TICK, fill: "#12332b" }} stroke={GRID} />
                    <Tooltip formatter={(v) => [`${fmtNum(v)} คน`, "สมาชิก"]} cursor={{ fill: "#e9f6f1" }} />
                    <Bar dataKey="members" fill={ACCENT} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      <LabelList dataKey="members" position="right" style={{ fontSize: 12, fill: "#35524a" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {data.genders.map((g) => (
                  <span key={g.gender} className="rounded-full bg-mint-50 px-3 py-1 text-mint-700">
                    {g.gender} {fmtNum(g.members)} คน ({pct(kpis.members ? g.members / kpis.members : 0)})
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
              <h2 className="mb-3 text-lg font-semibold">ตามสาขาประจำ</h2>
              <table className="w-full text-sm">
                <thead className="text-left text-stone-500">
                  <tr className="border-b border-stone-200">
                    <th className="py-2 font-medium">สาขา</th>
                    <th className="py-2 text-right font-medium">สมาชิก</th>
                    <th className="py-2 text-right font-medium">ใช้งานอยู่</th>
                    <th className="py-2 text-right font-medium">ยอดใช้จ่ายรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {data.branches.map((b) => (
                    <tr key={b.branch} className="border-b border-stone-100 last:border-0">
                      <td className="py-2.5">
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BRAND }} />
                        {b.branch}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{fmtNum(b.members)}</td>
                      <td className="py-2.5 text-right tabular-nums text-stone-500">{pct(b.active / b.members)}</td>
                      <td className="py-2.5 text-right font-medium tabular-nums">{fmtBaht(b.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
            <h2 className="text-lg font-semibold">รายชื่อสมาชิก</h2>
            <p className="mb-3 text-sm text-stone-500">เรียงตามยอดใช้จ่ายสูงสุด</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-stone-500">
                  <tr className="border-b border-stone-200">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">รหัส</th>
                    <th className="py-2 font-medium">ชื่อเล่น</th>
                    <th className="py-2 font-medium">สาขาประจำ</th>
                    <th className="py-2 font-medium">อายุ</th>
                    <th className="py-2 font-medium">สมัครเมื่อ</th>
                    <th className="py-2 text-right font-medium">บิล</th>
                    <th className="py-2 text-right font-medium">ใช้จ่ายรวม</th>
                    <th className="py-2 pl-4 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranked.slice(0, shown).map((c, i) => (
                    <tr key={c.customer_id} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 tabular-nums text-stone-400">{i + 1}</td>
                      <td className="py-2 font-mono text-xs">{c.customer_id}</td>
                      <td className="py-2">{c.nickname}</td>
                      <td className="py-2">{c.home_branch}</td>
                      <td className="py-2">{c.age_group}</td>
                      <td className="py-2 tabular-nums">{thaiDate(c.joined_date)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtNum(c.n_orders)}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{fmtBaht(c.total_spend)}</td>
                      <td className="py-2 pl-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${c.is_active ? "bg-mint-50 text-mint-700" : "bg-stone-100 text-stone-500"}`}>
                          {c.is_active ? "ใช้งาน" : "ไม่ใช้งาน"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown < data.ranked.length && (
              <button onClick={() => setShown((n) => n + PAGE)}
                      className="mt-4 w-full rounded-lg py-2 text-sm font-medium text-mint-700 ring-1 ring-mint-100 hover:bg-mint-50">
                แสดงเพิ่ม ({fmtNum(data.ranked.length - shown)} คนที่เหลือ)
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

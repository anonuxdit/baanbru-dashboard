// Lab 3.2 · Dashboard ยอดขายแบบ real-time จาก Firestore (Prompt 3.2B) + ฟอร์มบันทึกยอดขาย (Prompt 3.2C)
// ฟัง collection "sales" ตามช่วงวันที่ด้วย onSnapshot แล้วคำนวณด้วยฟังก์ชันเดียวกับหน้าภาพรวมจาก CSV
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { db } from "./firebase.js";
import { addDays, todayBangkok } from "./time.js";
import { BRANCHES } from "./saleModel.js";
import SaleForm from "./SaleForm.jsx";
import {
  computeKpis, dailyRevenue, fmtBaht, fmtBaht2, fmtNum, fmtShortBaht,
  hourlyRevenue, prepareRows, revenueByBranch,
} from "../lib/metrics.js";
import KpiCard from "../components/KpiCard.jsx";
import { BRAND, ACCENT, thaiDate } from "../Overview.jsx";

const RANGES = [
  { id: "today", label: "วันนี้", days: 1 },
  { id: "7d", label: "7 วัน", days: 7 },
  { id: "30d", label: "30 วัน", days: 30 },
];
const RECENT_LIMIT = 8;
const HIGHLIGHT_MS = 4000;

const ERROR_TEXT = {
  "permission-denied": "Security Rules ไม่อนุญาตให้อ่านข้อมูล ตรวจ Rules ใน Firebase console หรือว่าล็อกอินแล้วหรือยัง",
  "unauthenticated": "ต้องล็อกอินก่อนจึงจะอ่านข้อมูลได้",
  "failed-precondition": "Firestore ต้องสร้าง index สำหรับ query นี้ เปิดลิงก์ใน Console ของเบราว์เซอร์เพื่อสร้าง",
  "unavailable": "เชื่อมต่อ Firestore ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่",
  "resource-exhausted": "ใช้โควตาอ่านของ Firestore วันนี้หมดแล้ว ลองใหม่พรุ่งนี้",
};
const errorText = (e) => ERROR_TEXT[e.code] ?? `อ่านข้อมูลไม่สำเร็จ (${e.code ?? e.message})`;

/** ช่วงวันที่ตามเวลาไทย รวมวันนี้ เช่น 7 วัน = วันนี้และ 6 วันก่อนหน้า */
function rangeDates(days) {
  const end = todayBangkok();
  return { start: addDays(end, -(days - 1)), end };
}

export default function LiveTab() {
  const [rangeId, setRangeId] = useState("7d");
  const [branch, setBranch] = useState("");
  // ผลล่าสุดของ query พร้อม key ของช่วงวันที่ ถ้า key ไม่ตรงกับช่วงปัจจุบัน = ยังโหลดช่วงใหม่อยู่
  const [result, setResult] = useState({ key: "", docs: [], error: "" });
  const [reads, setReads] = useState(0);
  const [fresh, setFresh] = useState(() => new Set()); // id ของแถวที่เพิ่งเข้ามา
  const [products, setProducts] = useState(null);
  const [productsError, setProductsError] = useState("");
  const timers = useRef([]);

  const range = RANGES.find((r) => r.id === rangeId);
  const { start, end } = rangeDates(range.days);
  const key = `${start}|${end}`;
  const current = result.key === key;
  const status = !current ? "loading" : result.error ? "error" : "live";

  // เมนูโหลดครั้งเดียว (ไม่ต้อง real-time) แล้วส่งให้ฟอร์ม
  useEffect(() => {
    getDocs(collection(db, "products"))
      .then((snap) => {
        setProducts(snap.docs.map((d) => d.data()).sort((a, b) => a.product_id.localeCompare(b.product_id)));
        setReads((n) => n + snap.size);
      })
      .catch((e) => setProductsError(`โหลดเมนูไม่สำเร็จ: ${errorText(e)}`));
  }, []);

  useEffect(() => {
    const key = `${start}|${end}`;
    let first = true; // snapshot แรกคือข้อมูลที่มีอยู่แล้ว ไม่นับว่า "เพิ่งเข้ามา"

    const q = query(
      collection(db, "sales"),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const changes = snap.docChanges();
        setReads((n) => n + changes.length);
        setResult({ key, docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: "" });

        if (!first) {
          const added = changes.filter((c) => c.type === "added").map((c) => c.doc.id);
          if (added.length) {
            setFresh((s) => new Set([...s, ...added]));
            timers.current.push(setTimeout(() => {
              setFresh((s) => {
                const next = new Set(s);
                added.forEach((id) => next.delete(id));
                return next;
              });
            }, HIGHLIGHT_MS));
          }
        }
        first = false;
      },
      (e) => setResult({ key, docs: [], error: errorText(e) }),
    );

    return () => {
      unsubscribe();
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setFresh(new Set());
    };
  }, [start, end]);

  const view = useMemo(() => {
    const all = current ? prepareRows(result.docs) : [];
    const rows = branch ? all.filter((r) => r.branch === branch) : all;
    return {
      kpis: computeKpis(rows),
      daily: dailyRevenue(rows),
      hourly: hourlyRevenue(rows),
      branches: revenueByBranch(rows),
      recent: [...rows].sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, RECENT_LIMIT),
    };
  }, [current, result.docs, branch]);

  const { kpis } = view;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: BRAND }}>ยอดขายสด</h1>
            <p className="text-stone-500">
              {branch || "ทุกสาขา"} · {start === end ? thaiDate(end) : `${thaiDate(start)} – ${thaiDate(end)}`}
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm text-stone-500">
            <span className={`inline-block h-2 w-2 rounded-full ${status === "live" ? "animate-pulse bg-emerald-600" : status === "error" ? "bg-red-600" : "bg-stone-300"}`} />
            {status === "live" ? "เชื่อมต่อสด" : status === "error" ? "หยุดเชื่อมต่อ" : "กำลังโหลด…"}
            {" · "}อ่านไปแล้ว {fmtNum(reads)} เอกสาร
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-white p-1 ring-1 ring-stone-200">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRangeId(r.id)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${rangeId === r.id ? "bg-mint-700 text-white" : "text-stone-600 hover:bg-mint-50"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-200"
            aria-label="สาขา"
          >
            <option value="">ทุกสาขา</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {status === "error" ? (
          <p className="rounded-xl bg-red-50 px-5 py-4 text-red-800 ring-1 ring-red-200">❌ {result.error}</p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <KpiCard label="ยอดขายรวม" value={fmtBaht(kpis.revenue)} highlight />
              <KpiCard label="จำนวนบิล" value={fmtNum(kpis.bills)} />
              <KpiCard label="ยอดเฉลี่ยต่อบิล" value={fmtBaht2(kpis.avgPerBill)} />
              <KpiCard label="ลูกค้าสมาชิก" value={fmtNum(kpis.customers)} note="ไม่นับลูกค้า walk-in" />
            </section>

            <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
              <h2 className="mb-3 text-lg font-semibold">{rangeId === "today" ? "ยอดขายรายชั่วโมง" : "ยอดขายรายวัน"}</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {rangeId === "today" ? (
                    <BarChart data={view.hourly} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid stroke="#e1efe9" vertical={false} />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} interval={2} tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={fmtShortBaht} width={60} tick={{ fontSize: 12 }} />
                      <Tooltip labelFormatter={(h) => `${h}:00–${h}:59 น.`} formatter={(v) => [fmtBaht(v), "ยอดขาย"]} />
                      <Bar dataKey="revenue" fill={BRAND} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  ) : (
                    <LineChart data={view.daily} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid stroke="#e1efe9" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={thaiDate} minTickGap={40} tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={fmtShortBaht} width={60} tick={{ fontSize: 12 }} />
                      <Tooltip labelFormatter={thaiDate} formatter={(v) => [fmtBaht(v), "ยอดขาย"]} />
                      <Line dataKey="revenue" stroke={BRAND} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
              <h2 className="mb-3 text-lg font-semibold">ยอดขายแยกสาขา</h2>
              {view.branches.length === 0 ? (
                <p className="py-6 text-center text-sm text-stone-500">ยังไม่มียอดขายในช่วงนี้</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {view.branches.map((b) => (
                      <tr key={b.branch} className="border-b border-stone-100 last:border-0">
                        <td className="py-2">
                          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} />
                          {b.branch}
                        </td>
                        <td className="py-2 text-right tabular-nums text-stone-500">{fmtNum(b.bills)} บิล</td>
                        <td className="py-2 text-right font-medium tabular-nums">{fmtBaht(b.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
              <h2 className="mb-3 text-lg font-semibold">รายการล่าสุด</h2>
              {view.recent.length === 0 ? (
                <p className="py-6 text-center text-sm text-stone-500">
                  {status === "loading" ? "กำลังโหลด…" : "ยังไม่มีรายการในช่วงนี้"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-stone-500">
                      <tr className="border-b border-stone-200">
                        <th className="py-2 font-medium">เวลา</th>
                        <th className="py-2 font-medium">สาขา</th>
                        <th className="py-2 font-medium">เมนู</th>
                        <th className="py-2 text-right font-medium">จำนวน</th>
                        <th className="py-2 text-right font-medium">ยอด</th>
                        <th className="py-2 pl-4 font-medium">ชำระ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.recent.map((r) => (
                        <tr
                          key={r.id}
                          className={`border-b border-stone-100 transition-colors duration-700 last:border-0 ${fresh.has(r.id) ? "bg-amber-100" : ""}`}
                        >
                          <td className="py-2 tabular-nums">
                            {r.date === end ? "" : `${thaiDate(r.date)} `}{r.datetime.slice(11, 16)}
                          </td>
                          <td className="py-2">{r.branch}</td>
                          <td className="py-2">
                            {products?.find((p) => p.product_id === r.product_id)?.product_name ?? r.product_id}
                          </td>
                          <td className="py-2 text-right tabular-nums">{r.qty}</td>
                          <td className="py-2 text-right tabular-nums">{fmtBaht(r.revenue)}</td>
                          <td className="py-2 pl-4 text-stone-500">{r.payment_method}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <aside className="lg:sticky lg:top-28">
        <SaleForm products={products} productsError={productsError} />
      </aside>
    </div>
  );
}

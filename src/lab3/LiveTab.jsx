// Lab 3.2–3.3 · Dashboard ยอดขายแบบ real-time จาก Firestore + ฟอร์มบันทึกยอดขาย + ล็อกอินด้วย Google
// ฟัง collection "sales" ตามช่วงวันที่ด้วย onSnapshot แล้วคำนวณด้วยฟังก์ชันเดียวกับหน้าภาพรวมจาก CSV
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, db, googleProvider } from "./firebase.js";
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

const AUTH_ERROR_TEXT = {
  "auth/unauthorized-domain": `โดเมน ${location.hostname} ยังไม่ได้รับอนุญาต เพิ่มใน Firebase console → Authentication → Settings → Authorized domains`,
  "auth/operation-not-allowed": "ยังไม่ได้เปิดการล็อกอินด้วย Google เปิดได้ที่ Firebase console → Authentication → Sign-in method → Google",
  "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วกดเข้าสู่ระบบอีกครั้ง",
  "auth/popup-closed-by-user": "ปิดหน้าต่างล็อกอินก่อนเสร็จ กดเข้าสู่ระบบอีกครั้งเพื่อลองใหม่",
};
const authErrorText = (e) => AUTH_ERROR_TEXT[e.code] ?? `เข้าสู่ระบบไม่สำเร็จ (${e.code ?? e.message})`;

/**
 * แท็บสด: ตรวจการล็อกอินก่อน แล้วค่อยแสดง Dashboard
 * ยังไม่ล็อกอิน = ไม่ mount LiveDashboard จึงไม่มีการเริ่ม onSnapshot หรืออ่าน Firestore เลย
 */
export default function LiveTab() {
  const [user, setUser] = useState(undefined); // undefined = กำลังตรวจ, null = ยังไม่ล็อกอิน
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []); // คืนค่า unsubscribe ให้ cleanup

  async function signIn() {
    setBusy(true);
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code !== "auth/cancelled-popup-request") setAuthError(authErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) {
    return <p className="py-16 text-center text-stone-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto mt-6 max-w-md rounded-xl bg-white p-8 text-center ring-1 ring-stone-200">
        <h1 className="text-2xl font-bold" style={{ color: BRAND }}>ยอดขายสด</h1>
        <p className="mt-2 text-stone-500">เข้าสู่ระบบเพื่อดูยอดขายแบบ real-time และบันทึกยอดขาย</p>
        <button
          onClick={signIn}
          disabled={busy}
          className="mt-6 inline-flex items-center gap-3 rounded-lg bg-white px-5 py-2.5 font-medium text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60"
        >
          <GoogleIcon />
          {busy ? "กำลังเปิดหน้าต่างล็อกอิน…" : "เข้าสู่ระบบด้วย Google"}
        </button>
        {authError && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-800">❌ {authError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <UserChip user={user} onSignOut={() => signOut(auth)} />
      </div>
      <LiveDashboard user={user} />
    </div>
  );
}

function UserChip({ user, onSignOut }) {
  const name = user.displayName || user.email || "ผู้ใช้";
  return (
    <div className="flex items-center gap-3 rounded-full bg-white py-1 pl-1 pr-2 ring-1 ring-stone-200">
      {user.photoURL ? (
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-700 text-sm font-semibold text-white">
          {name[0].toUpperCase()}
        </span>
      )}
      <span className="max-w-[12rem] truncate text-sm font-medium">{name}</span>
      <button onClick={onSignOut} className="rounded-full px-3 py-1 text-sm text-stone-600 hover:bg-mint-50">
        ออกจากระบบ
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** ช่วงวันที่ตามเวลาไทย รวมวันนี้ เช่น 7 วัน = วันนี้และ 6 วันก่อนหน้า */
function rangeDates(days) {
  const end = todayBangkok();
  return { start: addDays(end, -(days - 1)), end };
}

function LiveDashboard({ user }) {
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
        <SaleForm products={products} productsError={productsError} uid={user.uid} />
      </aside>
    </div>
  );
}

import { useEffect, useState } from "react";
import Papa from "papaparse";
import Overview from "./Overview.jsx";
import Customers from "./Customers.jsx";
import Lab2Page from "./lab2/Lab2Page.jsx";
import LiveTab from "./lab3/LiveTab.jsx";
import RulesTester from "./lab3/RulesTester.jsx";
import SetupGuide from "./lab3/SetupGuide.jsx";
import { isConfigured } from "./lab3/firebase.js";
import { prepareRows } from "./lib/metrics.js";
import { prepareCustomers } from "./lib/customerMetrics.js";

const loadCsv = (url) =>
  new Promise((resolve, reject) =>
    Papa.parse(url, {
      download: true, header: true, skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    })
  );

/** โลโก้บ้านบรู: แก้วกาแฟบนพื้นเขียวมิ้น */
function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-11 w-11" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#157a62" />
      <path d="M8 13h13v5.5a5.5 5.5 0 0 1-5.5 5.5h-2A5.5 5.5 0 0 1 8 18.5V13Z" fill="#fff" />
      <path d="M21 14.5h1.5a2.5 2.5 0 0 1 0 5H21" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M12 6.5c-1 1.2 1 2.3 0 3.5M16 6.5c-1 1.2 1 2.3 0 3.5" fill="none" stroke="#3cc4a2" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const TABS = [
  { id: "overview", label: "ภาพรวม (CSV)" },
  { id: "customers", label: "ลูกค้า" },
  { id: "lab2", label: "Lab 2.2 · ซ่อมกราฟ" },
  { id: "live", label: "สด · Firestore" },
  { id: "rules", label: "ทดสอบ Rules" },
];

export default function App() {
  const [rows, setRows] = useState(null);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [customersError, setCustomersError] = useState(null);
  const [tab, setTab] = useState(() => TABS.find((t) => "#" + t.id === location.hash)?.id ?? "overview");

  useEffect(() => {
    Promise.all([loadCsv("/sales.csv"), loadCsv("/products.csv")])
      .then(([sales, prods]) => { setRows(prepareRows(sales)); setProducts(prods); })
      .catch((e) => setError(e.message ?? String(e)));
    // ข้อมูลลูกค้าโหลดแยก ถ้าไฟล์นี้มีปัญหา แท็บอื่นยังใช้งานได้
    loadCsv("/customers.csv")
      .then((c) => setCustomers(prepareCustomers(c)))
      .catch((e) => setCustomersError(e.message ?? String(e)));
  }, []);

  const choose = (id) => { setTab(id); history.replaceState(null, "", "#" + id); };
  const needsCsv = tab === "overview" || tab === "lab2";

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900">
      <nav className="sticky top-0 z-10 border-b border-stone-200 bg-stone-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4">
          <button onClick={() => choose("overview")} className="flex shrink-0 items-center gap-3 rounded-lg py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500">
            <Logo />
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-mint-700">บ้านบรู</span>
          </button>
          <div className="ml-auto flex min-w-0 gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => choose(t.id)}
                      className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 ${tab === t.id ? "bg-mint-700 text-white" : "text-stone-600 hover:bg-mint-100"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-5 py-8">
        {error && needsCsv && <p className="text-red-700">โหลดข้อมูลไม่สำเร็จ: {error} ตรวจว่ามี public/sales.csv และ public/products.csv</p>}
        {!error && needsCsv && !rows && <p className="text-stone-500">กำลังโหลดข้อมูลยอดขาย…</p>}
        {rows && tab === "overview" && <Overview rows={rows} />}
        {tab === "customers" && customersError && <p className="text-red-700">โหลดข้อมูลลูกค้าไม่สำเร็จ: {customersError} ตรวจว่ามี public/customers.csv</p>}
        {tab === "customers" && !customersError && !customers && <p className="text-stone-500">กำลังโหลดข้อมูลลูกค้า…</p>}
        {customers && tab === "customers" && <Customers customers={customers} />}
        {rows && tab === "lab2" && <Lab2Page rows={rows} products={products} />}
        {tab === "live" && (isConfigured ? <LiveTab /> : <SetupGuide />)}
        {tab === "rules" && (isConfigured ? <RulesTester /> : <SetupGuide />)}
      </div>
    </main>
  );
}

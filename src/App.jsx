import { useEffect, useState } from "react";
import Papa from "papaparse";
import Overview from "./Overview.jsx";
import Lab2Page from "./lab2/Lab2Page.jsx";
import LiveTab from "./lab3/LiveTab.jsx";
import RulesTester from "./lab3/RulesTester.jsx";
import SetupGuide from "./lab3/SetupGuide.jsx";
import { isConfigured } from "./lab3/firebase.js";
import { prepareRows } from "./lib/metrics.js";

const loadCsv = (url) =>
  new Promise((resolve, reject) =>
    Papa.parse(url, {
      download: true, header: true, skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    })
  );

const TABS = [
  { id: "overview", label: "ภาพรวม (CSV)" },
  { id: "lab2", label: "Lab 2.2 · ซ่อมกราฟ" },
  { id: "live", label: "สด · Firestore" },
  { id: "rules", label: "ทดสอบ Rules" },
];

export default function App() {
  const [rows, setRows] = useState(null);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => TABS.find((t) => "#" + t.id === location.hash)?.id ?? "overview");

  useEffect(() => {
    Promise.all([loadCsv("/sales.csv"), loadCsv("/products.csv")])
      .then(([sales, prods]) => { setRows(prepareRows(sales)); setProducts(prods); })
      .catch((e) => setError(e.message ?? String(e)));
  }, []);

  const choose = (id) => { setTab(id); history.replaceState(null, "", "#" + id); };
  const needsCsv = tab === "overview" || tab === "lab2";

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900">
      <nav className="sticky top-0 z-10 border-b border-stone-200 bg-stone-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 py-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => choose(t.id)}
                    className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${tab === t.id ? "bg-mint-700 text-white" : "text-stone-600 hover:bg-mint-100"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-5 py-8">
        {error && needsCsv && <p className="text-red-700">โหลดข้อมูลไม่สำเร็จ: {error} ตรวจว่ามี public/sales.csv และ public/products.csv</p>}
        {!error && needsCsv && !rows && <p className="text-stone-500">กำลังโหลดข้อมูลยอดขาย…</p>}
        {rows && tab === "overview" && <Overview rows={rows} />}
        {rows && tab === "lab2" && <Lab2Page rows={rows} products={products} />}
        {tab === "live" && (isConfigured ? <LiveTab /> : <SetupGuide />)}
        {tab === "rules" && (isConfigured ? <RulesTester /> : <SetupGuide />)}
      </div>
    </main>
  );
}

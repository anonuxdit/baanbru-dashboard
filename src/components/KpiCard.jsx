// highlight = การ์ดเด่นพื้นเขียวมิ้น (ใช้กับ KPI หลัก เช่น ยอดขายรวม)
export default function KpiCard({ label, value, note, highlight = false }) {
  return (
    <div className={`rounded-xl p-5 ${highlight ? "bg-mint-700 text-white shadow-sm" : "bg-white ring-1 ring-stone-200"}`}>
      <div className={`text-sm ${highlight ? "text-mint-100" : "text-stone-500"}`}>{label}</div>
      <div className={`mt-1 text-2xl sm:text-3xl font-semibold tabular-nums ${highlight ? "text-white" : "text-stone-900"}`}>{value}</div>
      {note && <div className={`mt-1 text-xs ${highlight ? "text-mint-100" : "text-stone-400"}`}>{note}</div>}
    </div>
  );
}

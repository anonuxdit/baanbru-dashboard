import { formatBaht, formatNumber } from '../lib/metrics'

// มือถือ/แท็บเล็ต: 2 คอลัมน์ (2×2) · จอกว้าง (lg): 4 คอลัมน์ โดยการ์ดยอดขายรวมกว้างกว่า
export default function KpiCards({ kpis }) {
  const secondary = [
    { label: 'จำนวนบิล', value: formatNumber(kpis.billCount), unit: 'บิล' },
    { label: 'ยอดเฉลี่ยต่อบิล', value: formatBaht(kpis.avgPerBill, 2) },
    { label: 'สมาชิกที่มาซื้อ (ไม่ซ้ำ)', value: formatNumber(kpis.uniqueMembers), unit: 'คน' },
  ]

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
      <div className="min-w-0 rounded-2xl bg-brand p-4 text-paper sm:p-6">
        <p className="text-sm text-paper/85">ยอดขายรวม</p>
        <p className="mt-2 text-lg font-bold tabular-nums sm:text-3xl xl:text-4xl">
          {formatBaht(kpis.totalSales, 2)}
        </p>
      </div>
      {secondary.map((k) => (
        <div key={k.label} className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5">
          <p className="text-sm leading-snug text-muted">{k.label}</p>
          <p className="mt-2 text-lg font-semibold tabular-nums sm:text-2xl">
            {k.value}
            {k.unit && <span className="ml-1 text-sm font-normal text-muted sm:text-base">{k.unit}</span>}
          </p>
        </div>
      ))}
    </section>
  )
}

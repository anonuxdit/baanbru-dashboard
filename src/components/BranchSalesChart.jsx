import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBaht, formatBahtCompact } from '../lib/metrics'
import { COLORS } from '../lib/theme'

// ใช้แท่งแนวนอน อ่านชื่อสาขาภาษาไทยได้ง่าย และข้อมูลเรียงมากไปน้อยจากบนลงล่างแล้ว
export default function BranchSalesChart({ data, selected = '' }) {
  const height = Math.max(200, data.length * 48)

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <h2 className="font-semibold">ยอดขายแยกสาขา</h2>
      <div className="mt-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.line} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => formatBahtCompact(v)}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="branch"
              width={96}
              tick={{ fill: COLORS.ink, fontSize: 13 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip formatter={(v) => [formatBaht(v, 2), 'ยอดขาย']} cursor={{ fill: COLORS.paper }} />
            <Bar dataKey="sales" fill={COLORS.brand} radius={[0, 6, 6, 0]} barSize={24}>
              {/* เลือกสาขาอยู่: สาขาอื่นจางลง ให้สาขาที่เลือกเด่น */}
              {data.map((d) => (
                <Cell key={d.branch} fillOpacity={!selected || d.branch === selected ? 1 : 0.25} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

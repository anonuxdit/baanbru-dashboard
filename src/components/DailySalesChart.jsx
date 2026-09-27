import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBaht, formatBahtCompact, formatThaiDate } from '../lib/metrics'
import { COLORS } from '../lib/theme'

const SERIES_NAMES = { sales: 'ยอดขายรายวัน', ma: 'ค่าเฉลี่ย 7 วัน' }

export default function DailySalesChart({ data }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <h2 className="font-semibold">ยอดขายรายวัน</h2>
      <div className="mt-4 h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.line} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatThaiDate(d, 'short')}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: COLORS.line }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v) => formatBahtCompact(v)}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              labelFormatter={(d) => formatThaiDate(d, true)}
              formatter={(v, key) => [v == null ? '–' : formatBaht(v, 2), SERIES_NAMES[key]]}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="plainline"
              formatter={(key) => <span className="text-sm text-muted">{SERIES_NAMES[key]}</span>}
            />

            {/* เส้นรายวัน: บางและจาง ให้เห็นความผันผวนเป็นพื้นหลัง */}
            <Line
              type="linear"
              dataKey="sales"
              stroke={COLORS.accent}
              strokeOpacity={0.35}
              strokeWidth={1.25}
              dot={false}
              activeDot={{ r: 3, fill: COLORS.accent }}
              isAnimationActive={false}
            />

            {/* เส้นค่าเฉลี่ย 7 วัน: เข้มและหนา วาดทีหลังจึงอยู่ด้านบน */}
            <Line
              type="monotone"
              dataKey="ma"
              stroke={COLORS.brand}
              strokeWidth={2.75}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

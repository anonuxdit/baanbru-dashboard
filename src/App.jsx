import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  computeKpis,
  dateBounds,
  filterRows,
  formatThaiDate,
  normalizeRows,
  salesByBranch,
  salesByDay,
  withMovingAverage,
} from './lib/metrics'
import FilterBar from './components/FilterBar'
import KpiCards from './components/KpiCards'
import DailySalesChart from './components/DailySalesChart'
import BranchSalesChart from './components/BranchSalesChart'

export default function App() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ branch: '', start: '', end: '' })

  useEffect(() => {
    Papa.parse('/sales.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(), // หัวคอลัมน์ในไฟล์มีช่องว่างหลังจุลภาค
      transform: (v) => v.trim(),
      complete: (result) => {
        const normalized = normalizeRows(result.data)
        const { min, max } = dateBounds(normalized)
        setRows(normalized)
        setFilters({ branch: '', start: min, end: max }) // เริ่มต้นที่ช่วงข้อมูลทั้งหมด
      },
      error: () => setError('โหลด public/sales.csv ไม่สำเร็จ ตรวจว่าไฟล์อยู่ในโฟลเดอร์ public และชื่อถูกต้อง'),
    })
  }, [])

  // ข้อมูลที่ไม่ขึ้นกับตัวกรอง: ช่วงวันที่ทั้งหมด และรายชื่อสาขา (เรียงตามยอดขายรวม)
  const meta = useMemo(() => {
    if (!rows) return null
    return { bounds: dateBounds(rows), branchNames: salesByBranch(rows).map((b) => b.branch) }
  }, [rows])

  const data = useMemo(() => {
    if (!rows) return null
    const { branch, start, end } = filters
    const { min, max } = meta.bounds
    const branchRows = filterRows(rows, { branch })

    // คำนวณค่าเฉลี่ย 7 วันจากข้อมูลทั้งช่วงก่อน แล้วค่อยตัดเฉพาะช่วงที่เลือก
    // วันแรก ๆ ของช่วงที่เลือกจึงยังมีค่าเฉลี่ย (ใช้ยอดของวันก่อนหน้าช่วง)
    const daily = withMovingAverage(salesByDay(branchRows, min, max), 7)
      .filter((d) => d.date >= start && d.date <= end)

    return {
      kpis: computeKpis(filterRows(branchRows, { start, end })),
      daily,
      // กราฟสาขากรองแค่ช่วงวันที่ เพื่อให้ยังเทียบกับสาขาอื่นได้ แล้วไฮไลต์สาขาที่เลือก
      branches: salesByBranch(filterRows(rows, { start, end })),
    }
  }, [rows, meta, filters])

  if (error) return <Message text={error} />
  if (!data) return <Message text="กำลังโหลดข้อมูลยอดขาย…" />
  if (rows.length === 0) return <Message text="ไม่พบรายการขายใน sales.csv ตรวจชื่อคอลัมน์และข้อมูลในไฟล์" />

  const updateFilters = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const resetFilters = () => setFilters({ branch: '', start: meta.bounds.min, end: meta.bounds.max })

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand sm:text-3xl">บ้านบรู Dashboard</h1>
        <p className="text-sm text-muted">
          {filters.branch || 'ทุกสาขา'} · {formatThaiDate(filters.start, true)} ถึง {formatThaiDate(filters.end, true)}
        </p>
      </header>

      <FilterBar
        branches={meta.branchNames}
        bounds={meta.bounds}
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      {data.kpis.billCount === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-6 py-12 text-center text-muted">
          ไม่มียอดขายตามตัวกรองที่เลือก ลองเปลี่ยนสาขาหรือขยายช่วงวันที่
        </p>
      ) : (
        <>
          <KpiCards kpis={data.kpis} />

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[3fr_2fr]">
            <DailySalesChart data={data.daily} />
            <BranchSalesChart data={data.branches} selected={filters.branch} />
          </div>
        </>
      )}
    </main>
  )
}

function Message({ text }) {
  return <p className="mx-auto max-w-xl px-6 py-16 text-center text-muted">{text}</p>
}

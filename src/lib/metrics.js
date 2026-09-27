// src/lib/metrics.js
// รวม logic การคำนวณทั้งหมดของ Dashboard ไว้ที่นี่ (ไม่มีโค้ด UI)

/** ปัดเศษเป็น 2 ตำแหน่ง ลดปัญหาทศนิยมลอยตัว เช่น 0.1 + 0.2 */
const round2 = (n) => Math.round(n * 100) / 100

/**
 * แปลงแถวดิบจาก PapaParse ให้เป็นข้อมูลที่พร้อมคำนวณ
 * - แปลง qty / unit_price เป็นตัวเลข แล้วคำนวณ revenue = qty × unit_price
 * - ดึงวันที่จากสตริงตรง ๆ (10 ตัวแรก) เพื่อคงวันที่ตามเวลาไทย
 *   ไม่ใช้ new Date() เพราะจะถูกแปลงเป็น timezone ของเครื่องที่เปิดเว็บ
 * - ตัดแถวที่ข้อมูลไม่ครบหรือเป็นตัวเลขไม่ได้ทิ้ง
 */
export function normalizeRows(rawRows) {
  const rows = []
  for (const r of rawRows) {
    const orderId = String(r.order_id ?? '').trim()
    const datetime = String(r.datetime ?? '').trim()
    const qty = Number(r.qty)
    const unitPrice = Number(r.unit_price)

    if (!orderId || !/^\d{4}-\d{2}-\d{2}/.test(datetime)) continue
    if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) continue

    rows.push({
      orderId,
      date: datetime.slice(0, 10), // "2025-04-01"
      branch: String(r.branch ?? '').trim() || 'ไม่ระบุสาขา',
      customerId: String(r.customer_id ?? '').trim(), // "" = ลูกค้าทั่วไป
      revenue: qty * unitPrice,
    })
  }
  return rows
}

/**
 * KPI หลัก 4 ตัว
 * - totalSales: ผลรวม revenue ทุกแถว
 * - billCount: จำนวน order_id ที่ไม่ซ้ำ (เพราะ 1 บิลมีได้หลายแถว)
 * - avgPerBill: totalSales ÷ billCount (เฉลี่ยต่อบิล ไม่ใช่ต่อแถว)
 * - uniqueMembers: จำนวน customer_id ที่ไม่ว่างและไม่ซ้ำ
 */
export function computeKpis(rows) {
  let totalSales = 0
  const bills = new Set()
  const members = new Set()

  for (const r of rows) {
    totalSales += r.revenue
    bills.add(r.orderId)
    if (r.customerId) members.add(r.customerId)
  }

  const billCount = bills.size
  return {
    totalSales: round2(totalSales),
    billCount,
    avgPerBill: billCount ? round2(totalSales / billCount) : 0,
    uniqueMembers: members.size,
  }
}

/**
 * กรองแถวตามสาขาและช่วงวันที่ (รวมวันเริ่มและวันสิ้นสุด)
 * - branch เป็น "" = ทุกสาขา
 * - start / end เป็น "YYYY-MM-DD" หรือ "" = ไม่จำกัดฝั่งนั้น
 *   เทียบเป็นสตริงได้ตรง ๆ เพราะรูปแบบ ISO เรียงตามตัวอักษรเท่ากับเรียงตามเวลา
 */
export function filterRows(rows, { branch = '', start = '', end = '' } = {}) {
  return rows.filter(
    (r) =>
      (!branch || r.branch === branch) &&
      (!start || r.date >= start) &&
      (!end || r.date <= end),
  )
}

/** วันแรกและวันสุดท้ายที่มีในข้อมูล คืนค่า { min, max } เป็น "YYYY-MM-DD" */
export function dateBounds(rows) {
  let min = ''
  let max = ''
  for (const r of rows) {
    if (!min || r.date < min) min = r.date
    if (!max || r.date > max) max = r.date
  }
  return { min, max }
}

/** เลื่อนวันที่แบบ "YYYY-MM-DD" ไป 1 วัน โดยคิดใน UTC ล้วน ๆ จึงไม่เพี้ยนตาม timezone */
function nextDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/**
 * ยอดขายรายวัน สำหรับ LineChart
 * - รวม revenue ตามวันที่ แล้วเรียงจากเก่าไปใหม่
 * - เติมวันที่ไม่มียอดขายเป็น 0 เพื่อให้เส้นกราฟไม่ลากข้ามวันที่หายไป
 * - ส่ง start / end มาได้ เพื่อให้แกนวันที่ครอบคลุมช่วงที่กำหนดเสมอ
 *   (เช่น สาขาที่ไม่มียอดขายช่วงต้นช่วง ก็ยังเริ่มแกนที่วันเดียวกับสาขาอื่น)
 * คืนค่า [{ date: "2025-04-01", sales: 12345 }, ...]
 */
export function salesByDay(rows, start, end) {
  const totals = new Map()
  for (const r of rows) {
    totals.set(r.date, (totals.get(r.date) ?? 0) + r.revenue)
  }
  const dates = [...totals.keys()].sort()
  const first = start ?? dates[0]
  const last = end ?? dates[dates.length - 1]
  if (!first || !last) return []

  const result = []
  for (let d = first; d <= last; d = nextDay(d)) {
    result.push({ date: d, sales: round2(totals.get(d) ?? 0) })
  }
  return result
}

/**
 * เพิ่มค่าเฉลี่ยเคลื่อนที่ย้อนหลัง (trailing moving average) ให้ข้อมูลรายวัน
 * - ma ของวันใด = ค่าเฉลี่ยยอดขายของวันนั้นและ (windowSize − 1) วันก่อนหน้า
 * - นับตามวันปฏิทิน ใช้ได้ถูกต้องเพราะ salesByDay เติมวันที่ไม่มียอดขายเป็น 0 แล้ว
 * - ช่วงแรกที่ยังมีข้อมูลไม่ครบ windowSize วัน ให้ค่าเป็น null (กราฟจะไม่วาดจุดนั้น)
 *   เพื่อไม่ให้ค่าเฉลี่ยจากข้อมูลแค่ 1–2 วันแกว่งจนเข้าใจผิด
 * - ใช้ผลรวมแบบเลื่อนหน้าต่าง บวกวันใหม่ ลบวันที่หลุดออก จึงคำนวณแค่รอบเดียว
 * คืนค่า [{ date, sales, ma: number | null }, ...]
 */
export function withMovingAverage(daily, windowSize = 7) {
  let windowSum = 0
  return daily.map((day, i) => {
    windowSum += day.sales
    if (i >= windowSize) windowSum -= daily[i - windowSize].sales
    return { ...day, ma: i >= windowSize - 1 ? round2(windowSum / windowSize) : null }
  })
}

/**
 * ยอดขายแยกสาขา สำหรับ BarChart
 * - รวม revenue ตามชื่อสาขา แล้วเรียงจากมากไปน้อย
 * คืนค่า [{ branch: "สาขา A", sales: 50000 }, ...]
 */
export function salesByBranch(rows) {
  const totals = new Map()
  for (const r of rows) {
    totals.set(r.branch, (totals.get(r.branch) ?? 0) + r.revenue)
  }
  return [...totals]
    .map(([branch, sales]) => ({ branch, sales: round2(sales) }))
    .sort((a, b) => b.sales - a.sales)
}

// ---------- ตัวจัดรูปแบบการแสดงผล ----------

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** ตัวเลขมีจุลภาค เช่น 12345 → "12,345" */
export function formatNumber(value, decimals = 0) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** จำนวนเงินบาท เช่น 12345.5 → "฿12,345.50" */
export function formatBaht(value, decimals = 0) {
  return `฿${formatNumber(value, decimals)}`
}

/** จำนวนเงินบาทแบบย่อ สำหรับแกนกราฟที่พื้นที่แคบ เช่น 125000 → "฿125K", 2400000 → "฿2.4M" */
export function formatBahtCompact(value) {
  return `฿${Number(value).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}`
}

/**
 * วันที่แบบย่อภาษาไทย (ปี พ.ศ.) เช่น "2025-04-01" →
 * - year = false (ค่าเริ่มต้น) → "1 เม.ย."
 * - year = true               → "1 เม.ย. 2568"
 * - year = 'short'            → "1 เม.ย. 68" (สำหรับแกนกราฟที่พื้นที่แคบ)
 */
export function formatThaiDate(dateStr, year = false) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const base = `${d} ${THAI_MONTHS[m - 1]}`
  if (!year) return base
  const be = y + 543
  return `${base} ${year === 'short' ? String(be).slice(-2) : be}`
}

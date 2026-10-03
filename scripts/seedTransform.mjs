// Lab 3.1 · แปลงแถวจาก sales.csv (ผลลัพธ์ Lab 2.1) เป็นเอกสาร Firestore
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.1 ใน PROMPTS_LAB3.md) จนกว่า npm test จะผ่านทุกข้อ
// scripts/seed.mjs เรียกใช้ฟังก์ชันเหล่านี้ ไม่ต้องแก้ seed.mjs
import { addDays, daysBetween } from "../src/lab3/time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];

/**
 * เลือกเฉพาะ N วันล่าสุดของข้อมูล นับจากวันล่าสุดในไฟล์ (ไม่ใช่วันนี้) รวมวันสุดท้ายด้วย
 * @returns {{ rows: object[], start: string, end: string }}  start/end เป็น YYYY-MM-DD
 */
export function selectLastDays(rows, days) {
  // วันที่อยู่ใน 10 ตัวแรกของ datetime ตามเวลาไทยอยู่แล้ว ตัดสตริงตรง ๆ ไม่ต้องผ่าน Date
  const dateOf = (r) => String(r.datetime ?? "").slice(0, 10);
  let end = "";
  for (const r of rows) if (dateOf(r) > end) end = dateOf(r);
  if (!end) return { rows: [], start: "", end: "" };

  const start = addDays(end, -(days - 1)); // รวมวันสุดท้าย: 3 วัน = end-2 ถึง end
  return { rows: rows.filter((r) => dateOf(r) >= start && dateOf(r) <= end), start, end };
}

/** จำนวนวันที่ต้องเลื่อน ให้วันล่าสุดของข้อมูลกลายเป็น "เมื่อวาน" ของ today · ห้ามติดลบ */
export function computeShift(lastDataDate, today) {
  return Math.max(0, daysBetween(lastDataDate, addDays(today, -1)));
}

/** เลื่อนวันที่ใน datetime ("2026-09-20T16:05:09+07:00") ไป days วัน โดยคงเวลาและ +07:00 */
export function shiftDateTime(iso, days) {
  // เปลี่ยนเฉพาะส่วน YYYY-MM-DD ส่วน "T16:05:09+07:00" คงเดิม จึงไม่มีการแปลงเป็น UTC
  return addDays(iso.slice(0, 10), days) + iso.slice(10);
}

const DATETIME_RE = /^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\+07:00$/;
const POSITIVE_INT_RE = /^[1-9]\d*$/;
const POSITIVE_NUM_RE = /^\d+(\.\d+)?$/;

/**
 * แปลง 1 แถว CSV (ทุกค่าเป็นข้อความ) เป็น { id, data }
 * id = order_id + "-" + product_id
 * data มีฟิลด์: order_id, datetime, date, hour, branch, product_id, qty, unit_price, revenue,
 *               customer_id (ว่าง = null), payment_method, channel, source = "import"
 * ต้อง throw Error ถ้าข้อมูลยังไม่สะอาด: qty ไม่ใช่จำนวนเต็มบวก, ราคาไม่ใช่ตัวเลขบวก,
 * สาขาไม่อยู่ใน BRANCHES, datetime ไม่ใช่ 20YY-MM-DDTHH:MM:SS+07:00
 */
export function toSaleDoc(row, shiftDays = 0) {
  const { order_id, product_id, branch, datetime, qty, unit_price, customer_id } = row;
  const where = `${order_id}-${product_id}`;

  if (!POSITIVE_INT_RE.test(qty)) throw new Error(`${where}: qty "${qty}" ไม่ใช่จำนวนเต็มบวก`);
  if (!POSITIVE_NUM_RE.test(unit_price) || Number(unit_price) <= 0) {
    throw new Error(`${where}: unit_price "${unit_price}" ไม่ใช่ตัวเลขบวก`);
  }
  if (!BRANCHES.includes(branch)) throw new Error(`${where}: สาขา "${branch}" ไม่ใช่ชื่อมาตรฐาน`);
  if (!DATETIME_RE.test(datetime)) throw new Error(`${where}: datetime "${datetime}" ไม่ใช่ 20YY-MM-DDTHH:MM:SS+07:00`);

  const dt = shiftDays ? shiftDateTime(datetime, shiftDays) : datetime;
  const q = Number(qty);
  const price = Number(unit_price);

  return {
    id: where,
    data: {
      order_id,
      datetime: dt,
      date: dt.slice(0, 10),
      hour: Number(dt.slice(11, 13)),
      branch,
      product_id,
      qty: q,
      unit_price: price,
      revenue: q * price,
      customer_id: customer_id ? customer_id : null,
      payment_method: row.payment_method,
      channel: row.channel,
      source: "import",
    },
  };
}

/** สรุป: { docs, bills (นับ order_id ไม่ซ้ำ), revenue, byBranch: {สาขา: ยอด}, start, end } */
export function summarize(docs) {
  const bills = new Set();
  const byBranch = {};
  let revenue = 0;
  let start = "";
  let end = "";

  for (const { data } of docs) {
    bills.add(data.order_id);
    revenue += data.revenue;
    byBranch[data.branch] = (byBranch[data.branch] ?? 0) + data.revenue;
    if (!start || data.date < start) start = data.date;
    if (data.date > end) end = data.date;
  }
  return { docs: docs.length, bills: bills.size, revenue, byBranch, start, end };
}

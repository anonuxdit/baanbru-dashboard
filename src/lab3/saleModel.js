// Lab 3.2 · ตรวจฟอร์มและสร้างเอกสารยอดขายใหม่
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.2A) จนกว่า npm test จะผ่านทุกข้อ
// เอกสารที่ได้ต้องมีโครงสร้างเดียวกับข้อมูลที่ import ใน Lab 3.1 เพื่อให้ metrics.js จาก Lab 1 ใช้ต่อได้
import { nowBangkokISO } from "./time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
export const PAYMENTS = ["QR พร้อมเพย์", "บัตรเครดิต", "เงินสด", "LINE MAN", "Grab"];
export const MAX_QTY = 20;

/**
 * ตรวจฟอร์ม { branch, product_id, qty, payment_method, customer_id } (ค่าเป็นข้อความจาก input)
 * คืน {} ถ้าถูกต้อง หรือ { ชื่อฟิลด์: ข้อความภาษาไทย } ถ้าผิด
 */
export function validateSaleForm(form, products) {
  const errors = {};
  const qty = String(form.qty ?? "").trim();
  const customerId = String(form.customer_id ?? "").trim();

  if (!BRANCHES.includes(form.branch)) errors.branch = "กรุณาเลือกสาขา";
  if (!products.some((p) => p.product_id === form.product_id)) errors.product_id = "กรุณาเลือกเมนู";
  // ต้องเป็นเลขจำนวนเต็มล้วน จึงตัด "1.5", "-1", "abc" และค่าว่างออกตั้งแต่ regex
  if (!/^\d+$/.test(qty) || Number(qty) < 1 || Number(qty) > MAX_QTY) {
    errors.qty = `จำนวนต้องเป็นจำนวนเต็ม 1–${MAX_QTY}`;
  }
  if (!PAYMENTS.includes(form.payment_method)) errors.payment_method = "กรุณาเลือกวิธีชำระเงิน";
  if (customerId && !/^C\d{5}$/i.test(customerId)) {
    errors.customer_id = "รหัสสมาชิกต้องเป็น C ตามด้วยตัวเลข 5 หลัก เช่น C01234";
  }
  return errors;
}

const ID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** เลขบิลจากเวลาไทย รูปแบบ WEB-YYYYMMDD-HHMMSS-XXXX (XXXX = ตัวเลข/อักษรพิมพ์ใหญ่สุ่ม 4 ตัว) */
export function makeOrderId(now = new Date(), rand = Math.random) {
  const iso = nowBangkokISO(now); // "2026-09-27T03:30:05+07:00"
  const ymd = iso.slice(0, 10).replaceAll("-", "");
  const hms = iso.slice(11, 19).replaceAll(":", "");
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ID_CHARS[Math.floor(rand() * ID_CHARS.length)];
  return `WEB-${ymd}-${hms}-${suffix}`;
}

/**
 * สร้าง { id, data } จากฟอร์มที่ผ่านการตรวจแล้ว
 * - ราคามาจาก product.price เสมอ · revenue = qty × ราคา · ตัวเลขทุกตัวเป็น number
 * - datetime/date/hour เป็นเวลาไทย (ใช้ nowBangkokISO)
 * - channel = "เดลิเวอรี" ถ้าจ่ายด้วย LINE MAN หรือ Grab ไม่งั้น "หน้าร้าน"
 * - source = "web", created_by = uid · ยังไม่ต้องใส่ created_at (ใส่ตอนบันทึกด้วย serverTimestamp())
 */
export function buildSale(form, product, { uid, now = new Date(), rand = Math.random }) {
  const datetime = nowBangkokISO(now);
  const order_id = makeOrderId(now, rand);
  const qty = Number(String(form.qty).trim());
  const unit_price = Number(product.price);
  const customerId = String(form.customer_id ?? "").trim().toUpperCase();

  return {
    id: `${order_id}-${product.product_id}`,
    data: {
      order_id,
      datetime,
      date: datetime.slice(0, 10),
      hour: Number(datetime.slice(11, 13)),
      branch: form.branch,
      product_id: product.product_id,
      qty,
      unit_price,
      revenue: qty * unit_price,
      customer_id: customerId || null,
      payment_method: form.payment_method,
      channel: ["LINE MAN", "Grab"].includes(form.payment_method) ? "เดลิเวอรี" : "หน้าร้าน",
      source: "web",
      created_by: uid,
    },
  };
}

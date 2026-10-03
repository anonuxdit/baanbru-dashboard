// ลบเอกสารทั้งหมดใน collection "sales" ก่อน seed ใหม่
//
//   npm run clear-sales              นับอย่างเดียว ยังไม่ลบ
//   npm run clear-sales -- --yes     ลบจริง (ย้อนกลับไม่ได้)
//
// ใช้ service account เดียวกับ npm run seed (FIREBASE_SERVICE_ACCOUNT ใน .env)
import fs from "node:fs";

const YES = process.argv.includes("--yes");
const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error("❌ ไม่พบ service account key ตั้งค่า FIREBASE_SERVICE_ACCOUNT ใน .env ให้ชี้ไปที่ไฟล์ JSON");
  process.exit(1);
}

const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const sales = db.collection("sales");

const before = (await sales.count().get()).data().count;
const web = (await sales.where("source", "==", "web").count().get()).data().count;
console.log(`โปรเจกต์: ${key.project_id}`);
console.log(`sales มี ${before.toLocaleString()} เอกสาร (บันทึกจากฟอร์มเว็บ ${web.toLocaleString()} รายการ)`);

if (!YES) {
  console.log("\nยังไม่ได้ลบ ถ้าแน่ใจให้รัน: npm run clear-sales -- --yes");
  process.exit(0);
}

console.log("กำลังลบ…");
await db.recursiveDelete(sales);
const after = (await sales.count().get()).data().count;
console.log(after === 0 ? `✅ ลบแล้ว ${before.toLocaleString()} เอกสาร` : `⚠️ ยังเหลือ ${after} เอกสาร ลองรันอีกครั้ง`);

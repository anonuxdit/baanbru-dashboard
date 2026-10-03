// ฟังก์ชันคำนวณของหน้าลูกค้า (public/customers.csv จากการบ้าน Lab 2 · customers_clean.csv)
// 1 แถว = สมาชิก 1 คน · n_orders / total_spend สรุปจากยอดขายมาแล้วในไฟล์

export const AGE_GROUPS = ["ต่ำกว่า 18", "18-24", "25-34", "35-44", "45-54", "55+"];
export const GENDERS = ["หญิง", "ชาย", "ไม่ระบุ"];

/** แปลงแถวดิบจาก CSV (ทุกค่าเป็นข้อความ) ให้ตัวเลขและ boolean พร้อมคำนวณ */
export function prepareCustomers(rows) {
  return rows
    .filter((r) => r.customer_id)
    .map((r) => ({
      ...r,
      is_minor: r.is_minor === "True",
      phone_shared: r.phone_shared === "True",
      is_active: r.is_active === "True",
      n_orders: Number(r.n_orders),
      total_spend: Number(r.total_spend),
      first_purchase_date: r.first_purchase_date || null, // ว่าง = ยังไม่เคยซื้อ
    }));
}

/**
 * KPI ของสมาชิก
 * - buyers: สมาชิกที่เคยซื้ออย่างน้อย 1 บิล
 * - avgSpend: ยอดใช้จ่ายเฉลี่ยต่อคน คิดเฉพาะคนที่เคยซื้อ (ไม่ให้คนที่ยังไม่ซื้อดึงค่าเฉลี่ยลง)
 */
export function customerKpis(customers) {
  const members = customers.length;
  const active = customers.filter((c) => c.is_active).length;
  const buyers = customers.filter((c) => c.n_orders > 0);
  const spend = buyers.reduce((s, c) => s + c.total_spend, 0);
  return {
    members,
    active,
    activeRate: members ? active / members : 0,
    buyers: buyers.length,
    avgSpend: buyers.length ? spend / buyers.length : 0,
    avgOrders: buyers.length ? buyers.reduce((s, c) => s + c.n_orders, 0) / buyers.length : 0,
  };
}

/** สมาชิกใหม่รายเดือน เรียงตามเดือน [{ month: "2025-04", members }] */
export function joinsByMonth(customers) {
  const map = new Map();
  for (const c of customers) map.set(c.joined_month, (map.get(c.joined_month) ?? 0) + 1);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, members]) => ({ month, members }));
}

/** จำนวนสมาชิกตามกลุ่มอายุ เรียงตาม AGE_GROUPS (ครบทุกกลุ่ม แม้เป็น 0) */
export function membersByAge(customers) {
  const counts = Object.fromEntries(AGE_GROUPS.map((g) => [g, 0]));
  for (const c of customers) if (c.age_group in counts) counts[c.age_group] += 1;
  return AGE_GROUPS.map((age_group) => ({ age_group, members: counts[age_group] }));
}

/** สรุปตามสาขาประจำ เรียงตามจำนวนสมาชิกมากไปน้อย [{ branch, members, active, spend }] */
export function membersByBranch(customers) {
  const map = new Map();
  for (const c of customers) {
    const cur = map.get(c.home_branch) ?? { branch: c.home_branch, members: 0, active: 0, spend: 0 };
    cur.members += 1;
    if (c.is_active) cur.active += 1;
    cur.spend += c.total_spend;
    map.set(c.home_branch, cur);
  }
  return [...map.values()].sort((a, b) => b.members - a.members);
}

/** จำนวนสมาชิกตามเพศ เรียงตาม GENDERS */
export function membersByGender(customers) {
  return GENDERS.map((gender) => ({ gender, members: customers.filter((c) => c.gender === gender).length }));
}

/** สมาชิกที่ใช้จ่ายสูงสุด n คน (เท่ากันให้คนที่ซื้อบ่อยกว่าขึ้นก่อน) */
export function topSpenders(customers, n = 10) {
  return [...customers]
    .sort((a, b) => b.total_spend - a.total_spend || b.n_orders - a.n_orders)
    .slice(0, n);
}

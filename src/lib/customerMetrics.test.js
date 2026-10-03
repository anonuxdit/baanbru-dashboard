import { describe, it, expect } from "vitest";
import { prepareCustomers, customerKpis, joinsByMonth, membersByAge, membersByBranch, topSpenders } from "./customerMetrics.js";

const raw = (o = {}) => ({
  customer_id: "C00001", nickname: "กมล", gender: "หญิง", age_group: "18-24", is_minor: "False",
  home_branch_id: "B02", home_branch: "สีลม", joined_date: "2026-03-03", joined_month: "2026-03",
  phone: "082-xxx-6693", phone_shared: "False", is_active: "True", first_purchase_date: "2026-03-19",
  n_orders: "3", total_spend: "344", ...o,
});

describe("prepareCustomers", () => {
  it("แปลงตัวเลขและ boolean จากข้อความ", () => {
    const [c] = prepareCustomers([raw()]);
    expect(c.n_orders).toBe(3);
    expect(c.total_spend).toBe(344);
    expect(c.is_active).toBe(true);
    expect(c.is_minor).toBe(false);
  });
  it("วันซื้อครั้งแรกว่าง = null และตัดแถวที่ไม่มีรหัส", () => {
    const rows = prepareCustomers([raw({ first_purchase_date: "" }), raw({ customer_id: "" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].first_purchase_date).toBeNull();
  });
});

describe("customerKpis", () => {
  it("ยอดเฉลี่ยคิดเฉพาะคนที่เคยซื้อ", () => {
    const k = customerKpis(prepareCustomers([
      raw({ total_spend: "300", n_orders: "3" }),
      raw({ customer_id: "C00002", total_spend: "100", n_orders: "1", is_active: "False" }),
      raw({ customer_id: "C00003", total_spend: "0", n_orders: "0" }),
    ]));
    expect(k.members).toBe(3);
    expect(k.buyers).toBe(2);
    expect(k.avgSpend).toBe(200);
    expect(k.active).toBe(2);
  });
  it("ไม่มีข้อมูลไม่หารด้วยศูนย์", () => {
    expect(customerKpis([])).toMatchObject({ members: 0, activeRate: 0, avgSpend: 0 });
  });
});

describe("การจัดกลุ่ม", () => {
  const cs = prepareCustomers([
    raw(),
    raw({ customer_id: "C00002", joined_month: "2025-12", age_group: "55+", home_branch: "สยาม", total_spend: "900" }),
    raw({ customer_id: "C00003", total_spend: "500" }),
  ]);
  it("สมาชิกใหม่รายเดือนเรียงตามเดือน", () => {
    expect(joinsByMonth(cs)).toEqual([{ month: "2025-12", members: 1 }, { month: "2026-03", members: 2 }]);
  });
  it("กลุ่มอายุครบทุกกลุ่มตามลำดับ", () => {
    const ages = membersByAge(cs);
    expect(ages).toHaveLength(6);
    expect(ages[0]).toEqual({ age_group: "ต่ำกว่า 18", members: 0 });
    expect(ages.find((a) => a.age_group === "18-24").members).toBe(2);
  });
  it("สาขาประจำรวมยอดใช้จ่าย", () => {
    expect(membersByBranch(cs)[0]).toMatchObject({ branch: "สีลม", members: 2, spend: 844 });
  });
  it("ลูกค้าใช้จ่ายสูงสุด", () => {
    expect(topSpenders(cs, 2).map((c) => c.customer_id)).toEqual(["C00002", "C00003"]);
  });
});

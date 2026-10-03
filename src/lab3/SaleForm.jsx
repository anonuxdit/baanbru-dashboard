// Lab 3.2 · ฟอร์มบันทึกยอดขาย (Prompt 3.2C)
// ตรวจด้วย validateSaleForm และสร้างเอกสารด้วย buildSale จึงมีโครงสร้างเดียวกับข้อมูลที่ import
import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { BRANCHES, MAX_QTY, PAYMENTS, buildSale, validateSaleForm } from "./saleModel.js";
import { fmtBaht } from "../lib/metrics.js";
import { BRAND } from "../Overview.jsx";

const UID = "anonymous"; // Lab 3.3 จะเปลี่ยนเป็น uid ของผู้ใช้ที่ล็อกอิน
const EMPTY = { branch: "", product_id: "", qty: "1", payment_method: PAYMENTS[0], customer_id: "" };

const inputClass = (bad) =>
  `mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ${bad ? "ring-red-400" : "ring-stone-200"} focus:outline-none focus:ring-2 focus:ring-stone-400`;

function Field({ label, error, children }) {
  return (
    <label className="block text-sm">
      <span className="text-stone-500">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

/** products = [{ product_id, product_name, price, ... }] โหลดจาก Firestore ครั้งเดียวใน LiveTab */
export default function SaleForm({ products, productsError }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { ok: boolean, text: string }

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setMessage(null);
  };

  // ยอดรวมก่อนบันทึก: ใช้ buildSale ตัวเดียวกับตอนบันทึกจริง แสดงเมื่อเมนูและจำนวนถูกต้องแล้ว
  const product = products?.find((p) => p.product_id === form.product_id);
  const check = products ? validateSaleForm(form, products) : {};
  const preview = product && !check.qty ? buildSale(form, product, { uid: UID }).data : null;

  async function submit(e) {
    e.preventDefault();
    const found = validateSaleForm(form, products);
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length) return;

    const { id, data } = buildSale(form, product, { uid: UID });
    setSaving(true);
    try {
      await setDoc(doc(db, "sales", id), { ...data, created_at: serverTimestamp() });
      setMessage({ ok: true, text: `บันทึกแล้ว ${data.order_id} · ${fmtBaht(data.revenue)}` });
      setForm((f) => ({ ...EMPTY, branch: f.branch, payment_method: f.payment_method })); // สาขาเดิมขายต่อได้เลย
    } catch (err) {
      setMessage({
        ok: false,
        text: err.code === "permission-denied" ? "ถูกปฏิเสธโดย Security Rules" : `บันทึกไม่สำเร็จ (${err.code ?? err.message})`,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">บันทึกยอดขาย</h2>

      {productsError && <p className="text-sm text-red-700">❌ {productsError}</p>}

      <Field label="สาขา" error={errors.branch}>
        <select value={form.branch} onChange={update("branch")} className={inputClass(errors.branch)}>
          <option value="">— เลือกสาขา —</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </Field>

      <Field label="เมนู" error={errors.product_id}>
        <select value={form.product_id} onChange={update("product_id")} className={inputClass(errors.product_id)} disabled={!products}>
          <option value="">{products ? "— เลือกเมนู —" : "กำลังโหลดเมนู…"}</option>
          {products?.map((p) => (
            <option key={p.product_id} value={p.product_id}>{p.product_name} · {fmtBaht(p.price)}</option>
          ))}
        </select>
      </Field>

      <Field label={`จำนวน (1–${MAX_QTY})`} error={errors.qty}>
        <input type="number" inputMode="numeric" min="1" max={MAX_QTY} step="1"
               value={form.qty} onChange={update("qty")} className={inputClass(errors.qty)} />
      </Field>

      <Field label="วิธีชำระเงิน" error={errors.payment_method}>
        <select value={form.payment_method} onChange={update("payment_method")} className={inputClass(errors.payment_method)}>
          {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="รหัสสมาชิก (ไม่บังคับ)" error={errors.customer_id}>
        <input type="text" placeholder="เช่น C01234" autoComplete="off"
               value={form.customer_id} onChange={update("customer_id")} className={inputClass(errors.customer_id)} />
      </Field>

      <div className="flex items-baseline justify-between border-t border-stone-200 pt-4">
        <span className="text-sm text-stone-500">ยอดรวม</span>
        <span className="text-2xl font-semibold tabular-nums">{preview ? fmtBaht(preview.revenue) : "—"}</span>
      </div>
      {preview && <p className="-mt-3 text-right text-xs text-stone-500">{preview.qty} × {fmtBaht(preview.unit_price)} · {preview.channel}</p>}

      <button type="submit" disabled={saving || !products}
              style={{ background: BRAND }}
              className="w-full rounded-lg py-2.5 font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? "กำลังบันทึก…" : "บันทึกยอดขาย"}
      </button>

      {message && (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {message.ok ? "✅ " : "❌ "}{message.text}
        </p>
      )}
    </form>
  );
}

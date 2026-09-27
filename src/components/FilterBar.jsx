// แถบตัวกรอง: เลือกสาขา + ช่วงวันที่
// ค่าทั้งหมดเป็นสตริง: branch "" = ทุกสาขา, start/end เป็น "YYYY-MM-DD"
export default function FilterBar({ branches, bounds, filters, onChange, onReset }) {
  const { branch, start, end } = filters
  const isDefault = !branch && start === bounds.min && end === bounds.max

  const fieldClass =
    'mt-1 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink ' +
    'focus:border-brand focus:outline-none focus:ring-2 focus:ring-accent/40'

  return (
    <section className="grid grid-cols-2 items-end gap-3 rounded-2xl border border-line bg-white p-4 sm:p-5 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
      <label className="col-span-2 text-sm text-muted lg:col-span-1">
        สาขา
        <select
          className={fieldClass}
          value={branch}
          onChange={(e) => onChange({ branch: e.target.value })}
        >
          <option value="">ทุกสาขา</option>
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </label>

      <label className="text-sm text-muted">
        ตั้งแต่วันที่
        <input
          type="date"
          className={fieldClass}
          value={start}
          min={bounds.min}
          max={end || bounds.max}
          required
          onChange={(e) => onChange({ start: e.target.value || bounds.min })}
        />
      </label>

      <label className="text-sm text-muted">
        ถึงวันที่
        <input
          type="date"
          className={fieldClass}
          value={end}
          min={start || bounds.min}
          max={bounds.max}
          required
          onChange={(e) => onChange({ end: e.target.value || bounds.max })}
        />
      </label>

      <button
        type="button"
        onClick={onReset}
        disabled={isDefault}
        className="col-span-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-brand hover:bg-paper disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent lg:col-span-1"
      >
        ล้างตัวกรอง
      </button>
    </section>
  )
}

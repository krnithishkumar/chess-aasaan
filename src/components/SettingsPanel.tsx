import type { Settings } from '../lib/types';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  return (
    <section className="card settings">
      <label>
        chess.com username
        <input value={settings.username} onChange={(e) => onChange({ ...settings, username: e.target.value.trim() })} />
      </label>
      <label>
        Training hours per day
        <select value={settings.hoursPerDay} onChange={(e) => onChange({ ...settings, hoursPerDay: Number(e.target.value) })}>
          {[1, 1.5, 2, 3, 4, 5, 6].map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
      <label>
        Months to fetch
        <input
          type="number"
          min={1}
          max={24}
          value={settings.months}
          onChange={(e) => onChange({ ...settings, months: Math.max(1, Number(e.target.value)) })}
        />
      </label>
      <label>
        Engine depth
        <select value={settings.depth} onChange={(e) => onChange({ ...settings, depth: Number(e.target.value) })}>
          {[12, 14, 16, 18, 20].map((d) => (
            <option key={d} value={d}>
              {d}
              {d === 16 ? ' (default)' : d >= 18 ? ' (slow)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.sound} onChange={(e) => onChange({ ...settings, sound: e.target.checked })} />
        Move sounds
      </label>
      <p className="muted small">
        Depth applies to new analyses. Everything is stored in this browser only.
      </p>
      <button onClick={onClose}>Done</button>
    </section>
  );
}

import { useState } from 'react'

export default function SimpleModal({ title, fields, values, onClose, onSave, saving }) {
  const [form, setForm] = useState(values)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 420 }}>
        <div className="modal-header">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button className="btn btn-icon" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          {fields.map(f => (
            <div className="form-group" key={f.key}>
              <label>{f.label}</label>
              {f.type === 'select' ? (
                <select value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)}>
                  <option value="">Selecione...</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.key] || ''}
                  placeholder={f.placeholder || ''}
                  onChange={e => set(f.key, f.upper ? e.target.value.toUpperCase() : e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

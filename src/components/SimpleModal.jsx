import { useState } from 'react'

export default function SimpleModal({ title, fields, values, onClose, onSave, saving }) {
  const [form, setForm] = useState(() => {
    const initial = {}
    fields.forEach(f => { initial[f.key] = values?.[f.key] ?? '' })
    return initial
  })

  const set = (key, val, upper) => {
    setForm(f => ({ ...f, [key]: upper ? val.toUpperCase() : val }))
  }

  const handleSubmit = () => {
    onSave(form)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button className="btn btn-icon" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          {fields.map(f => (
            <div className="form-group" key={f.key}>
              <label>{f.label}</label>
              {f.type === 'select' ? (
                <select value={form[f.key]} onChange={e => set(f.key, e.target.value)}>
                  <option value="">Selecione...</option>
                  {(f.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : f.type === 'number' ? (
                <input
                  type="number"
                  value={form[f.key]}
                  placeholder={f.placeholder || ''}
                  onChange={e => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  value={form[f.key]}
                  placeholder={f.placeholder || ''}
                  onChange={e => set(f.key, e.target.value, f.upper)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../supabaseClient'
import SimpleModal from '../components/SimpleModal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Veiculos({ veiculos, onChanged, notify }) {
  const [modal, setModal] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async (form) => {
    if (!form.placa || !form.modelo) { notify('Placa e modelo são obrigatórios.', 'error'); return }
    setSaving(true)
    const payload = { placa: form.placa.toUpperCase(), modelo: form.modelo }
    let error
    if (modal.editing) {
      ({ error } = await supabase.from('veiculos').update(payload).eq('id', modal.editing.id))
    } else {
      ({ error } = await supabase.from('veiculos').insert(payload))
    }
    setSaving(false)
    if (error) notify('Erro: ' + error.message, 'error')
    else { notify(modal.editing ? 'Veículo atualizado!' : 'Veículo cadastrado!'); setModal(null); onChanged() }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('veiculos').delete().eq('id', id)
    if (error) notify('Erro ao excluir: ' + error.message, 'error')
    else { notify('Veículo excluído.', 'warning'); onChanged() }
    setConfirmId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => setModal({ editing: null })}><i className="fas fa-plus"></i> Novo Veículo</button>
      </div>
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Placa</th><th>Modelo</th><th>Ações</th></tr></thead>
            <tbody>
              {veiculos.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Nenhum veículo cadastrado.</td></tr>
              ) : veiculos.map(v => (
                <tr key={v.id}>
                  <td><b>{v.placa}</b></td>
                  <td>{v.modelo}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-icon btn-sm" onClick={() => setModal({ editing: v })}><i className="fas fa-edit"></i></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmId(v.id)}><i className="fas fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <SimpleModal
          title={modal.editing ? 'Editar Veículo' : 'Cadastrar Veículo'}
          fields={[
            { key: 'placa', label: 'Placa', upper: true, placeholder: 'ABC-1234' },
            { key: 'modelo', label: 'Modelo' },
          ]}
          values={modal.editing || {}}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {confirmId && (
        <ConfirmDialog message="Excluir este veículo?" onCancel={() => setConfirmId(null)} onConfirm={() => handleDelete(confirmId)} />
      )}
    </div>
  )
}

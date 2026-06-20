import { useState } from 'react'
import { supabase } from '../supabaseClient'
import SimpleModal from '../components/SimpleModal'
import ConfirmDialog from '../components/ConfirmDialog'

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function Servicos({ servicos, onChanged, notify, clienteId }) {
  const [modal, setModal] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async (form) => {
    if (!form.cod || !form.nome || !form.valor) { notify('Preencha todos os campos.', 'error'); return }
    setSaving(true)
    const payload = { cod: form.cod, nome: form.nome, valor: Number(form.valor), cliente_id: clienteId }
    let error
    if (modal.editing) {
      ({ error } = await supabase.from('servicos').update(payload).eq('id', modal.editing.id))
    } else {
      ({ error } = await supabase.from('servicos').insert(payload))
    }
    setSaving(false)
    if (error) notify('Erro: ' + error.message, 'error')
    else { notify(modal.editing ? 'Serviço atualizado!' : 'Serviço cadastrado!'); setModal(null); onChanged() }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('servicos').delete().eq('id', id)
    if (error) notify('Erro ao excluir: ' + error.message, 'error')
    else { notify('Serviço excluído.', 'warning'); onChanged() }
    setConfirmId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => setModal({ editing: null })}><i className="fas fa-plus"></i> Novo Serviço</button>
      </div>
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Código</th><th>Nome do Serviço</th><th>Valor (R$)</th><th>Ações</th></tr></thead>
            <tbody>
              {servicos.map(s => (
                <tr key={s.id}>
                  <td><span className="badge" style={{ background: '#eff6ff', color: '#2563eb' }}>{s.cod}</span></td>
                  <td>{s.nome}</td>
                  <td><b>R$ {fmt(s.valor)}</b></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-icon btn-sm" onClick={() => setModal({ editing: s })}><i className="fas fa-edit"></i></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmId(s.id)}><i className="fas fa-trash"></i></button>
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
          title={modal.editing ? 'Editar Serviço' : 'Cadastrar Serviço'}
          fields={[
            { key: 'cod', label: 'Código' },
            { key: 'nome', label: 'Nome do Serviço' },
            { key: 'valor', label: 'Valor (R$)', type: 'number' },
          ]}
          values={modal.editing || {}}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {confirmId && (
        <ConfirmDialog message="Excluir este serviço?" onCancel={() => setConfirmId(null)} onConfirm={() => handleDelete(confirmId)} />
      )}
    </div>
  )
}

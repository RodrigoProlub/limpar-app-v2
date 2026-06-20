import { useState } from 'react'
import { supabase } from '../supabaseClient'
import SimpleModal from '../components/SimpleModal'
import ConfirmDialog from '../components/ConfirmDialog'

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function Comissoes({ comissoes, vendedores, onChanged, notify, clienteId }) {
  const [modal, setModal] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async (form) => {
    if (!form.vendedor || !form.valor) { notify('Preencha todos os campos.', 'error'); return }
    setSaving(true)
    const payload = { vendedor: form.vendedor, valor: Number(form.valor), cliente_id: clienteId }
    let error
    if (modal.editing) {
      ({ error } = await supabase.from('comissoes').update(payload).eq('id', modal.editing.id))
    } else {
      // remove existing commission for this vendedor first, then insert
      await supabase.from('comissoes').delete().eq('vendedor', form.vendedor).eq('cliente_id', clienteId)
      ;({ error } = await supabase.from('comissoes').insert(payload))
    }
    setSaving(false)
    if (error) notify('Erro: ' + error.message, 'error')
    else { notify('Comissão salva!'); setModal(null); onChanged() }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('comissoes').delete().eq('id', id)
    if (error) notify('Erro ao excluir: ' + error.message, 'error')
    else { notify('Comissão excluída.', 'warning'); onChanged() }
    setConfirmId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => setModal({ editing: null })}><i className="fas fa-plus"></i> Definir Comissão</button>
      </div>
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Vendedor</th><th>Comissão por Venda (R$)</th><th>Ações</th></tr></thead>
            <tbody>
              {comissoes.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Nenhuma comissão configurada.</td></tr>
              ) : comissoes.map(c => (
                <tr key={c.id}>
                  <td>{c.vendedor}</td>
                  <td><b>R$ {fmt(c.valor)}</b> <span style={{ color: '#94a3b8', fontSize: 11 }}>/ venda</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-icon btn-sm" onClick={() => setModal({ editing: c })}><i className="fas fa-edit"></i></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmId(c.id)}><i className="fas fa-trash"></i></button>
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
          title={modal.editing ? 'Editar Comissão' : 'Definir Comissão'}
          fields={[
            { key: 'vendedor', label: 'Vendedor', type: 'select', options: vendedores.map(v => v.nome) },
            { key: 'valor', label: 'Valor Fixo por Venda (R$)', type: 'number' },
          ]}
          values={modal.editing || {}}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {confirmId && (
        <ConfirmDialog message="Excluir esta comissão?" onCancel={() => setConfirmId(null)} onConfirm={() => handleDelete(confirmId)} />
      )}
    </div>
  )
}

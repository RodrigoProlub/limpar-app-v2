import { useState } from 'react'
import { supabase } from '../supabaseClient'
import SimpleModal from '../components/SimpleModal'
import ConfirmDialog from '../components/ConfirmDialog'

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function Vendedores({ vendedores, onChanged, notify, clienteId }) {
  const [modal, setModal] = useState(null) // { editing }
  const [confirmId, setConfirmId] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async (form) => {
    if (!form.nome) { notify('Nome é obrigatório.', 'error'); return }
    setSaving(true)
    const payload = { nome: form.nome, tel: form.tel || '', cargo: form.cargo || '', meta: Number(form.meta) || 0, status: form.status || 'Ativo', cliente_id: clienteId }
    let error
    if (modal.editing) {
      ({ error } = await supabase.from('vendedores').update(payload).eq('id', modal.editing.id))
    } else {
      ({ error } = await supabase.from('vendedores').insert(payload))
    }
    setSaving(false)
    if (error) notify('Erro: ' + error.message, 'error')
    else { notify(modal.editing ? 'Vendedor atualizado!' : 'Vendedor cadastrado!'); setModal(null); onChanged() }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('vendedores').delete().eq('id', id)
    if (error) notify('Erro ao excluir: ' + error.message, 'error')
    else { notify('Vendedor excluído.', 'warning'); onChanged() }
    setConfirmId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => setModal({ editing: null })}><i className="fas fa-plus"></i> Novo Vendedor</button>
      </div>
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Nome</th><th>Telefone</th><th>Cargo</th><th>Meta Mensal</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {vendedores.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Nenhum vendedor cadastrado.</td></tr>
              ) : vendedores.map(v => (
                <tr key={v.id}>
                  <td><b>{v.nome}</b></td>
                  <td>{v.tel || '—'}</td>
                  <td>{v.cargo || '—'}</td>
                  <td>R$ {fmt(v.meta)}</td>
                  <td><span className={'badge ' + (v.status === 'Ativo' ? 'badge-success' : 'badge-danger')}>{v.status}</span></td>
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
          title={modal.editing ? 'Editar Vendedor' : 'Cadastrar Vendedor'}
          fields={[
            { key: 'nome', label: 'Nome' },
            { key: 'tel', label: 'Telefone' },
            { key: 'cargo', label: 'Cargo' },
            { key: 'meta', label: 'Meta Mensal (R$)', type: 'number' },
            { key: 'status', label: 'Status', type: 'select', options: ['Ativo', 'Inativo'] },
          ]}
          values={modal.editing || { status: 'Ativo' }}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {confirmId && (
        <ConfirmDialog message="Excluir este vendedor?" onCancel={() => setConfirmId(null)} onConfirm={() => handleDelete(confirmId)} />
      )}
    </div>
  )
}

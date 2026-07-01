import { useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import ConfirmDialog from '../components/ConfirmDialog'

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d) { if (!d) return '—'; const [y, m, da] = d.split('-'); return `${da}/${m}/${y}` }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function mesLabel(mes) {
  if (!mes) return 'Todos os meses'
  const [ano, m] = mes.split('-')
  return MESES[Number(m) - 1] + '/' + ano
}

function Badge({ status }) {
  const map = { 'Concluído': 'badge-success', 'Pendente': 'badge-warning', 'Cancelado': 'badge-danger' }
  return <span className={'badge ' + (map[status] || '')}>{status}</span>
}

export default function Vendas({ vendas, vendedores, onNovaVenda, onEditVenda, onDeleted, notify }) {
  const mesAtual = new Date().toISOString().slice(0, 7)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [vendF, setVendF] = useState('')
  const [mesF, setMesF] = useState(mesAtual)
  const [confirmId, setConfirmId] = useState(null)

  // meses disponíveis (todos que têm venda)
  const mesesDisponiveis = useMemo(() => {
    const set = new Set()
    vendas.forEach(v => { if (v.data) set.add(v.data.slice(0, 7)) })
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [vendas])

  const filtered = useMemo(() => {
    return vendas.filter(v => {
      if (mesF && !v.data.startsWith(mesF)) return false
      if (statusF && v.status !== statusF) return false
      if (vendF && v.vendedor !== vendF) return false
      if (search && !((v.cliente + v.placa + v.servico + v.vendedor + v.os_num) + '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [vendas, search, statusF, vendF, mesF])

  const totalMes = useMemo(() => filtered.reduce((s, v) => s + Number(v.valor || 0), 0), [filtered])
  const qtdMes = filtered.length

  const handleDelete = async (id) => {
    const { error } = await supabase.from('vendas').delete().eq('id', id)
    if (error) notify('Erro ao excluir: ' + error.message, 'error')
    else { notify('TMO/Venda excluída.', 'warning'); onDeleted() }
    setConfirmId(null)
  }

  return (
    <div>
      <div className="table-header" style={{ background: 'transparent', border: 'none', padding: 0, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Filtro de mês em destaque */}
          <select
            value={mesF}
            onChange={e => setMesF(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '2px solid #29abe2', fontWeight: 600, color: '#0f1f33', background: '#f0faff' }}
          >
            <option value="">Todos os meses</option>
            {mesesDisponiveis.map(m => (
              <option key={m} value={m}>{mesLabel(m)}{m === mesAtual ? ' ← atual' : ''}</option>
            ))}
          </select>
          <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', width: 160 }} />
          <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
            <option value="">Todos status</option>
            <option>Pendente</option><option>Concluído</option><option>Cancelado</option>
          </select>
          <select value={vendF} onChange={e => setVendF(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
            <option value="">Todos vendedores</option>
            {vendedores.map(v => <option key={v.id}>{v.nome}</option>)}
          </select>
          {/* Resumo rápido do filtro atual */}
          {mesF && (
            <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', borderRadius: 6, padding: '4px 10px' }}>
              {qtdMes} TMO · R$ {fmt(totalMes)}
            </span>
          )}
        </div>
        <button className="btn btn-primary" onClick={onNovaVenda}><i className="fas fa-plus"></i> Nova TMO/Venda</button>
      </div>

      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>OS Nº</th><th>Data</th><th>Cliente Final</th><th>Placa</th><th>Serviço</th>
                <th>Valor</th><th>Vendedor</th><th>Pagamento</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  {mesF ? `Nenhuma TMO/Venda em ${mesLabel(mesF)}.` : 'Nenhuma TMO/Venda encontrada.'}
                </td></tr>
              ) : filtered.map(v => (
                <tr key={v.id}>
                  <td><b style={{ color: '#2563eb' }}>#{String(v.os_num).padStart(4, '0')}</b></td>
                  <td>{fmtDate(v.data)}</td>
                  <td>{v.cliente}</td>
                  <td>{v.placa || '—'}</td>
                  <td>{v.servico}</td>
                  <td><b>R$ {fmt(v.valor)}</b></td>
                  <td>{v.vendedor}</td>
                  <td>{v.pgto}</td>
                  <td><Badge status={v.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-icon btn-sm" onClick={() => onEditVenda(v)}><i className="fas fa-edit"></i></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmId(v.id)}><i className="fas fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmId && (
        <ConfirmDialog
          message="Excluir este TMO/Venda? Esta ação não pode ser desfeita."
          onCancel={() => setConfirmId(null)}
          onConfirm={() => handleDelete(confirmId)}
        />
      )}
    </div>
  )
}

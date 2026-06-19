import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d) { if (!d) return '—'; const [y, m, da] = d.split('-'); return `${da}/${m}/${y}` }

function Badge({ status }) {
  const map = { 'Concluído': 'badge-success', 'Pendente': 'badge-warning', 'Cancelado': 'badge-danger' }
  return <span className={'badge ' + (map[status] || '')}>{status}</span>
}

export default function Relatorios({ vendas, vendedores, servicos, notify }) {
  const [filters, setFilters] = useState({ vendedor: '', servico: '', dataIni: '', dataFim: '', status: '' })

  const filtered = useMemo(() => {
    return vendas.filter(v => {
      if (filters.vendedor && v.vendedor !== filters.vendedor) return false
      if (filters.servico && v.servico !== filters.servico) return false
      if (filters.dataIni && v.data < filters.dataIni) return false
      if (filters.dataFim && v.data > filters.dataFim) return false
      if (filters.status && v.status !== filters.status) return false
      return true
    })
  }, [vendas, filters])

  const exportExcel = () => {
    const rows = filtered.map(v => ({
      'OS Nº': '#' + String(v.os_num).padStart(4, '0'), 'Data': v.data, 'Cliente Final': v.cliente,
      'Placa': v.placa, 'Modelo': v.modelo, 'Serviço': v.servico, 'Valor (R$)': v.valor,
      'Vendedor': v.vendedor, 'Forma de Pagamento': v.pgto, 'Status': v.status, 'Observações': v.obs || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
    XLSX.writeFile(wb, 'relatorio-limpar-' + new Date().toISOString().slice(0, 10) + '.xlsx')
    notify('Relatório Excel exportado!')
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Filtros de Relatório</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Vendedor</label>
            <select value={filters.vendedor} onChange={e => setFilters({ ...filters, vendedor: e.target.value })}>
              <option value="">Todos</option>
              {vendedores.map(v => <option key={v.id}>{v.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Serviço</label>
            <select value={filters.servico} onChange={e => setFilters({ ...filters, servico: e.target.value })}>
              <option value="">Todos</option>
              {servicos.map(s => <option key={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Data Inicial</label>
            <input type="date" value={filters.dataIni} onChange={e => setFilters({ ...filters, dataIni: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Data Final</label>
            <input type="date" value={filters.dataFim} onChange={e => setFilters({ ...filters, dataFim: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Status</label>
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Todos</option>
              <option>Pendente</option><option>Concluído</option><option>Cancelado</option>
            </select>
          </div>
        </div>
        <button className="btn btn-success" onClick={exportExcel}><i className="fas fa-file-excel"></i> Exportar Excel</button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div style={{ fontWeight: 600 }}>Resultado do Relatório</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{filtered.length} registro(s) | Total: R$ {fmt(filtered.reduce((s, v) => s + v.valor, 0))}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>OS Nº</th><th>Data</th><th>Cliente Final</th><th>Serviço</th><th>Valor</th><th>Vendedor</th><th>Pagamento</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Nenhum resultado encontrado.</td></tr>
              ) : filtered.map(v => (
                <tr key={v.id}>
                  <td><b>#{String(v.os_num).padStart(4, '0')}</b></td>
                  <td>{fmtDate(v.data)}</td>
                  <td>{v.cliente}</td>
                  <td>{v.servico}</td>
                  <td><b>R$ {fmt(v.valor)}</b></td>
                  <td>{v.vendedor}</td>
                  <td>{v.pgto}</td>
                  <td><Badge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

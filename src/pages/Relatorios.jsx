import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d) { if (!d) return '—'; const [y, m, da] = d.split('-'); return `${da}/${m}/${y}` }

function Badge({ status }) {
  const map = { 'Concluído': 'badge-success', 'Pendente': 'badge-warning', 'Cancelado': 'badge-danger' }
  return <span className={'badge ' + (map[status] || '')}>{status}</span>
}

function gerarPDF(filtered, clienteNome, filters) {
  const total = filtered.reduce((s, v) => s + Number(v.valor || 0), 0)
  const concluidas = filtered.filter(v => v.status === 'Concluído')
  const totalComissao = 0 // sem dados de comissão aqui, só informativo

  const linhas = filtered.map((v, i) => `
    <tr style="background:${i % 2 === 0 ? '#0d1526' : '#111827'}">
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;color:#FFB000;font-weight:700">#${String(v.os_num).padStart(4,'0')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;color:rgba(255,255,255,0.8)">${fmtDate(v.data)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;color:rgba(255,255,255,0.8)">${v.cliente}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;color:rgba(255,255,255,0.8)">${v.servico}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;color:rgba(255,255,255,0.8)">${v.vendedor}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;color:rgba(255,255,255,0.8)">${v.pgto}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;font-weight:700;color:${v.status === 'Concluído' ? '#4ade80' : v.status === 'Cancelado' ? '#f87171' : '#fbbf24'}">${v.status}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;font-weight:700;color:white;text-align:right">R$ ${fmt(v.valor)}</td>
    </tr>
  `).join('')

  const periodo = filters.dataIni && filters.dataFim
    ? `${fmtDate(filters.dataIni)} a ${fmtDate(filters.dataFim)}`
    : filters.dataIni ? `A partir de ${fmtDate(filters.dataIni)}`
    : filters.dataFim ? `Até ${fmtDate(filters.dataFim)}`
    : 'Todos os períodos'

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório LimpAr Auto — ${clienteNome}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0a0f1e; color: white; padding: 2rem; }
  @media print {
    body { padding: 1rem; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div style="max-width:900px;margin:0 auto">
    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;padding-bottom:1rem;border-bottom:2px solid #FFB000">
      <div>
        <div style="font-size:24px;font-weight:900;color:#FFB000;letter-spacing:1px">LimpAr Auto</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:2px">Gestão Comercial</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:700;color:white">${clienteNome}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px">Relatório gerado em ${fmtDate(new Date().toISOString().slice(0,10))}</div>
      </div>
    </div>

    <!-- RESUMO -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:2rem">
      <div style="background:rgba(255,176,0,0.1);border:1px solid rgba(255,176,0,0.3);border-radius:12px;padding:14px">
        <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Total TMO/Venda</div>
        <div style="font-size:26px;font-weight:900;color:#FFB000">${filtered.length}</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px">
        <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Concluídas</div>
        <div style="font-size:26px;font-weight:900;color:#4ade80">${concluidas.length}</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px">
        <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Período</div>
        <div style="font-size:13px;font-weight:700;color:white;margin-top:4px">${periodo}</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px">
        <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Faturamento Total</div>
        <div style="font-size:18px;font-weight:900;color:white;margin-top:4px">R$ ${fmt(total)}</div>
      </div>
    </div>

    <!-- FILTROS APLICADOS -->
    ${(filters.vendedor || filters.servico || filters.status) ? `
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 14px;margin-bottom:1.5rem;font-size:12px;color:rgba(255,255,255,0.5)">
      Filtros: ${[filters.vendedor && 'Vendedor: '+filters.vendedor, filters.servico && 'Serviço: '+filters.servico, filters.status && 'Status: '+filters.status].filter(Boolean).join(' · ')}
    </div>` : ''}

    <!-- TABELA -->
    <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
      <thead>
        <tr style="background:rgba(255,176,0,0.12)">
          <th style="padding:10px;text-align:left;font-size:10px;text-transform:uppercase;color:rgba(255,176,0,0.8);letter-spacing:0.5px">OS Nº</th>
          <th style="padding:10px;text-align:left;font-size:10px;text-transform:uppercase;color:rgba(255,176,0,0.8);letter-spacing:0.5px">Data</th>
          <th style="padding:10px;text-align:left;font-size:10px;text-transform:uppercase;color:rgba(255,176,0,0.8);letter-spacing:0.5px">Cliente Final</th>
          <th style="padding:10px;text-align:left;font-size:10px;text-transform:uppercase;color:rgba(255,176,0,0.8);letter-spacing:0.5px">Serviço</th>
          <th style="padding:10px;text-align:left;font-size:10px;text-transform:uppercase;color:rgba(255,176,0,0.8);letter-spacing:0.5px">Vendedor</th>
          <th style="padding:10px;text-align:left;font-size:10px;text-transform:uppercase;color:rgba(255,176,0,0.8);letter-spacing:0.5px">Pgto</th>
          <th style="padding:10px;text-align:left;font-size:10px;text-transform:uppercase;color:rgba(255,176,0,0.8);letter-spacing:0.5px">Status</th>
          <th style="padding:10px;text-align:right;font-size:10px;text-transform:uppercase;color:rgba(255,176,0,0.8);letter-spacing:0.5px">Valor</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
      <tfoot>
        <tr style="background:rgba(255,176,0,0.08)">
          <td colspan="7" style="padding:10px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.7)">TOTAL GERAL</td>
          <td style="padding:10px;text-align:right;font-size:15px;font-weight:900;color:#FFB000">R$ ${fmt(total)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="text-align:center;margin-top:2rem;font-size:11px;color:rgba(255,255,255,0.2)">
      LimpAr Auto Gestão Comercial · Documento gerado automaticamente
    </div>
  </div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) alert('Permita pop-ups para gerar o PDF.')
}

export default function Relatorios({ vendas, vendedores, servicos, notify, clienteNome }) {
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

  const exportPDF = () => {
    if (filtered.length === 0) { notify('Nenhum dado para exportar.', 'warning'); return }
    gerarPDF(filtered, clienteNome || 'LimpAr Auto', filters)
    notify('PDF aberto para impressão!')
  }

  const totalFiltrado = filtered.reduce((s, v) => s + Number(v.valor || 0), 0)

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: 10, color: 'white' }}>Filtros de Relatório</div>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={exportExcel}>
            <i className="fas fa-file-excel"></i> Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={exportPDF}>
            <i className="fas fa-file-pdf"></i> Exportar PDF
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div style={{ fontWeight: 600, color: 'white' }}>Resultado do Relatório</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            {filtered.length} registro(s) · Total: <b style={{ color: '#FFB000' }}>R$ {fmt(totalFiltrado)}</b>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>OS Nº</th><th>Data</th><th>Cliente Final</th><th>Serviço</th><th>Valor</th><th>Vendedor</th><th>Pagamento</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '2rem' }}>Nenhum resultado encontrado.</td></tr>
              ) : filtered.map(v => (
                <tr key={v.id}>
                  <td><b style={{ color: '#FFB000' }}>#{String(v.os_num).padStart(4, '0')}</b></td>
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

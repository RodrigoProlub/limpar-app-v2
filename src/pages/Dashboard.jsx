import { useMemo, useRef, useEffect } from 'react'
import Chart from 'chart.js/auto'

function fmt(n) {
  return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function BarChart({ labels, values }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Faturamento (R$)', data: values, backgroundColor: '#2563eb', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$' + fmt(v) } } } }
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [JSON.stringify(labels), JSON.stringify(values)])
  return <div style={{ position: 'relative', height: 240 }}><canvas ref={ref}></canvas></div>
}

function DoughnutChart({ labels, values }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    const colors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']
    chartRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } } }
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [JSON.stringify(labels), JSON.stringify(values)])
  return <div style={{ position: 'relative', height: 240 }}><canvas ref={ref}></canvas></div>
}

export default function Dashboard({ vendas, vendedores, comissoes, onNovaVenda }) {
  const dash = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const mes = hoje.slice(0, 7)
    const ano = hoje.slice(0, 4)
    const total = vendas.length
    const concluidas = vendas.filter(v => v.status === 'Concluído').length
    const pendentes = vendas.filter(v => v.status === 'Pendente').length
    const canceladas = vendas.filter(v => v.status === 'Cancelado').length
    const fatDia = vendas.filter(v => v.data === hoje && v.status !== 'Cancelado').reduce((s, v) => s + v.valor, 0)
    const fatMes = vendas.filter(v => v.data.startsWith(mes) && v.status !== 'Cancelado').reduce((s, v) => s + v.valor, 0)
    const fatAno = vendas.filter(v => v.data.startsWith(ano) && v.status !== 'Cancelado').reduce((s, v) => s + v.valor, 0)
    const vendasMes = vendas.filter(v => v.data.startsWith(mes) && v.status !== 'Cancelado')
    const ticket = vendasMes.length ? fatMes / vendasMes.length : 0
    const servCount = {}
    vendas.forEach(v => { if (v.status !== 'Cancelado') servCount[v.servico] = (servCount[v.servico] || 0) + 1 })
    const maisVendido = Object.keys(servCount).sort((a, b) => servCount[b] - servCount[a])[0] || '—'
    const vendFat = {}
    vendas.forEach(v => { if (v.status !== 'Cancelado') vendFat[v.vendedor] = (vendFat[v.vendedor] || 0) + v.valor })
    const melhor = Object.keys(vendFat).sort((a, b) => vendFat[b] - vendFat[a])[0] || '—'
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const year = new Date().getFullYear()
    const fatMensal = months.map((m, i) => {
      const key = year + '-' + String(i + 1).padStart(2, '0')
      return vendas.filter(v => v.data.startsWith(key) && v.status !== 'Cancelado').reduce((s, v) => s + v.valor, 0)
    })
    return { total, concluidas, pendentes, canceladas, fatDia, fatMes, fatAno, ticket, maisVendido, melhor, months, fatMensal, servCount, mes }
  }, [vendas])

  const commissionList = useMemo(() => {
    return vendedores.map(v => {
      const vendasConcluidasMes = vendas.filter(x => x.vendedor === v.nome && x.data.startsWith(dash.mes) && x.status === 'Concluído')
      const fat = vendas.filter(x => x.vendedor === v.nome && x.data.startsWith(dash.mes) && x.status !== 'Cancelado').reduce((s, x) => s + x.valor, 0)
      const com = comissoes.find(c => c.vendedor === v.nome)
      const valorFixo = com ? com.valor : 0
      const qtd = vendasConcluidasMes.length
      return { nome: v.nome, fat, qtd, valorFixo, total: valorFixo * qtd }
    })
  }, [vendedores, vendas, comissoes, dash.mes])

  const statCard = (label, value, sub, color) => (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )

  return (
    <div>
      <button className="btn-nova-venda" onClick={onNovaVenda}>
        <i className="fas fa-plus-circle" style={{ fontSize: 20 }}></i> Registrar Nova TMO/Venda
      </button>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>TMO/VENDAS</div>
      <div className="stats-grid">
        {statCard('Total de TMO/Venda', dash.total, 'Registradas')}
        {statCard('Concluídas', dash.concluidas, 'Finalizadas', '#16a34a')}
        {statCard('Pendentes', dash.pendentes, 'Aguardando', '#d97706')}
        {statCard('Canceladas', dash.canceladas, 'Canceladas', '#dc2626')}
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>FINANCEIRO</div>
      <div className="stats-grid">
        {statCard('Faturamento Hoje', 'R$ ' + fmt(dash.fatDia))}
        {statCard('Faturamento do Mês', 'R$ ' + fmt(dash.fatMes))}
        {statCard('Faturamento do Ano', 'R$ ' + fmt(dash.fatAno))}
        {statCard('Comissões do Mês (Total)', 'R$ ' + fmt(commissionList.reduce((s, c) => s + c.total, 0)), 'A pagar aos vendedores', '#dc2626')}
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>INDICADORES</div>
      <div className="stats-grid">
        {statCard('Ticket Médio', 'R$ ' + fmt(dash.ticket), 'Mês atual')}
        {statCard('Serviço Mais Vendido', dash.maisVendido)}
        {statCard('Melhor Vendedor', dash.melhor)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Faturamento Mensal</div>
          <BarChart labels={dash.months} values={dash.fatMensal} />
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Serviços Mais Vendidos</div>
          {Object.keys(dash.servCount).length > 0
            ? <DoughnutChart labels={Object.keys(dash.servCount)} values={Object.values(dash.servCount)} />
            : <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>Sem dados ainda.</p>}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Comissões por Vendedor (Mês Atual)</div>
        {commissionList.length === 0 ? <p style={{ color: '#94a3b8' }}>Nenhum vendedor cadastrado.</p> :
          commissionList.map(c => (
            <div key={c.nome} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{c.qtd} TMO/venda(s) concluída(s) × R$ {fmt(c.valorFixo)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#16a34a' }}>R$ {fmt(c.total)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>a receber</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

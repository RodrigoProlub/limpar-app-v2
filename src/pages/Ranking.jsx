import { useMemo, useRef, useEffect } from 'react'
import Chart from 'chart.js/auto'

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function HBarChart({ labels, values }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'bar', data: { labels, datasets: [{ label: 'Faturamento', data: values, backgroundColor: '#2563eb', borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { callback: v => 'R$' + fmt(v) } } } }
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [JSON.stringify(labels), JSON.stringify(values)])
  return <div style={{ position: 'relative', height: Math.max(labels.length * 40 + 80, 160) }}><canvas ref={ref}></canvas></div>
}

export default function Ranking({ vendas, vendedores }) {
  const mes = new Date().toISOString().slice(0, 7)

  const ranking = useMemo(() => {
    return vendedores.map(v => {
      const vs = vendas.filter(x => x.vendedor === v.nome && x.status !== 'Cancelado')
      const vsMes = vs.filter(x => x.data.startsWith(mes))
      const fat = vs.reduce((s, x) => s + x.valor, 0)
      const fatMes = vsMes.reduce((s, x) => s + x.valor, 0)
      const ticket = vsMes.length ? fatMes / vsMes.length : 0
      const metaPerc = v.meta ? Math.round((fatMes / v.meta) * 100) : 0
      return { ...v, qtd: vs.length, qtdMes: vsMes.length, fat, fatMes, ticket, metaPerc }
    }).sort((a, b) => b.fat - a.fat)
  }, [vendedores, vendas, mes])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Ranking de Vendedores</div>
          {ranking.length === 0 ? <p style={{ color: '#94a3b8' }}>Nenhum vendedor cadastrado.</p> :
            ranking.map((v, i) => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{v.nome}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{v.qtdMes} TMO/vendas | R$ {fmt(v.fatMes)} no mês</div>
                </div>
                <div style={{ fontWeight: 700 }}>R$ {fmt(v.fat)}</div>
              </div>
            ))}
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Faturamento por Vendedor</div>
          {ranking.length > 0 ? <HBarChart labels={ranking.map(v => v.nome)} values={ranking.map(v => v.fat)} /> : <p style={{ color: '#94a3b8' }}>Sem dados.</p>}
        </div>
      </div>
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Posição</th><th>Vendedor</th><th>Qtd. TMO/Venda</th><th>Faturamento</th><th>Ticket Médio</th><th>Meta</th><th>% Meta</th></tr></thead>
            <tbody>
              {ranking.map((v, i) => (
                <tr key={v.id}>
                  <td>{i + 1}º</td>
                  <td><b>{v.nome}</b></td>
                  <td>{v.qtd}</td>
                  <td>R$ {fmt(v.fat)}</td>
                  <td>R$ {fmt(v.ticket)}</td>
                  <td>R$ {fmt(v.meta)}</td>
                  <td>
                    <span className={'badge ' + (v.metaPerc >= 100 ? 'badge-success' : v.metaPerc >= 50 ? 'badge-warning' : 'badge-danger')}>{v.metaPerc}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

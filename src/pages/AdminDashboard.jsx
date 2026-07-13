import { useMemo, useRef, useEffect, useState } from 'react'
import Chart from 'chart.js/auto'
import { supabase } from '../supabaseClient'

function fmt(n) {
  return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const  MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function mesLabel(mes) {
  if (!mes) return '—'
  const [ano, m] = mes.split('-')
  return MESES_LABEL[Number(m) - 1] + '/' + ano
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

function Dashboard({ vendas = [], vendedores = [], comissoes = [], onNovaVenda }) {
  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual)
  const [trabalhaDomingo, setTrabalhaDomingo] = useState(() => {
    return localStorage.getItem('limpar_trabalha_domingo') === 'true'
  })

  const toggleDomingo = (val) => {
    setTrabalhaDomingo(val)
    localStorage.setItem('limpar_trabalha_domingo', String(val))
  }

  // meses disponíveis (sempre inclui o mês atual)
  const mesesDisponiveis = useMemo(() => {
    const set = new Set([mesAtual])
    vendas.forEach(v => { if (v.data) set.add(v.data.slice(0, 7)) })
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [vendas, mesAtual])

  const dash = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const ano = hoje.slice(0, 4)
    const vendasMes = vendas.filter(v => v.data.startsWith(mesSelecionado))
    const total = vendasMes.length
    const concluidas = vendasMes.filter(v => v.status === 'Concluído').length
    const pendentes = vendasMes.filter(v => v.status === 'Pendente').length
    const canceladas = vendasMes.filter(v => v.status === 'Cancelado').length
    const fatDia = vendas.filter(v => v.data === hoje && v.status !== 'Cancelado').reduce((s, v) => s + v.valor, 0)
    const fatMes = vendasMes.filter(v => v.status !== 'Cancelado').reduce((s, v) => s + v.valor, 0)
    const fatAno = vendas.filter(v => v.data.startsWith(ano) && v.status !== 'Cancelado').reduce((s, v) => s + v.valor, 0)
    const vendasConcluidasMes = vendasMes.filter(v => v.status !== 'Cancelado')
    const ticket = vendasConcluidasMes.length ? fatMes / vendasConcluidasMes.length : 0
    const servCount = {}
    vendasMes.forEach(v => { if (v.status !== 'Cancelado') servCount[v.servico] = (servCount[v.servico] || 0) + 1 })
    const maisVendido = Object.keys(servCount).sort((a, b) => servCount[b] - servCount[a])[0] || '—'
    const vendFat = {}
    vendasMes.forEach(v => { if (v.status !== 'Cancelado') vendFat[v.vendedor] = (vendFat[v.vendedor] || 0) + v.valor })
    const melhor = Object.keys(vendFat).sort((a, b) => vendFat[b] - vendFat[a])[0] || '—'
    const year = new Date().getFullYear()
    const fatMensal = MESES_LABEL.map((m, i) => {
      const key = year + '-' + String(i + 1).padStart(2, '0')
      return vendas.filter(v => v.data.startsWith(key) && v.status !== 'Cancelado').reduce((s, v) => s + v.valor, 0)
    })
    // Projeção de fechamento do mês (com dias úteis reais)
    const hojeDate = new Date()
    const anoProj = hojeDate.getFullYear()
    const mes = hojeDate.getMonth()
    const diaAtual = hojeDate.getDate()
    const totalDiasMes = new Date(anoProj, mes + 1, 0).getDate()

    // Conta dias úteis passados e restantes no mês
    let diasUteisPastados = 0
    let diasUteisRestantes = 0
    for (let d = 1; d <= totalDiasMes; d++) {
      const diaSemana = new Date(anoProj, mes, d).getDay() // 0=dom, 6=sab
      const ehUtil = trabalhaDomingo ? diaSemana !== 6 : diaSemana !== 0 && diaSemana !== 6
      if (d <= diaAtual) { if (ehUtil) diasUteisPastados++ }
      else { if (ehUtil) diasUteisRestantes++ }
    }

    const mediaDiaria = diasUteisPastados > 0 ? total / diasUteisPastados : 0
    const projecaoTotal = Math.round(total + mediaDiaria * diasUteisRestantes)
    const projecaoFat = fatMes + (fatMes / (total || 1)) * (mediaDiaria * diasUteisRestantes)

    return { total, concluidas, pendentes, canceladas, fatDia, fatMes, fatAno, ticket, maisVendido, melhor, fatMensal, servCount, diaAtual, totalDiasMes, diasUteisPastados, diasUteisRestantes, mediaDiaria, projecaoTotal, projecaoFat }
  }, [vendas, mesSelecionado, trabalhaDomingo])

  const commissionList = useMemo(() => {
    return vendedores.map(v => {
      const vendasConcluidasMes = vendas.filter(x => x.vendedor === v.nome && x.data.startsWith(mesSelecionado) && x.status === 'Concluído')
      const fat = vendas.filter(x => x.vendedor === v.nome && x.data.startsWith(mesSelecionado) && x.status !== 'Cancelado').reduce((s, x) => s + x.valor, 0)
      const com = comissoes.find(c => c.vendedor === v.nome)
      const valorFixo = com ? com.valor : 0
      const qtd = vendasConcluidasMes.length
      return { nome: v.nome, fat, qtd, valorFixo, total: valorFixo * qtd }
    })
  }, [vendedores, vendas, comissoes, mesSelecionado])

  const statCard = (label, value, sub, color) => (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )

  return (
    <div>
      {onNovaVenda && (
        <button className="btn-nova-venda" onClick={onNovaVenda}>
          <i className="fas fa-plus-circle" style={{ fontSize: 20 }}></i> Registrar Nova TMO/Venda
        </button>
      )}

      {/* Seletor de mês */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>EXIBINDO:</span>
        <select
          value={mesSelecionado}
          onChange={e => setMesSelecionado(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '2px solid #29abe2', fontWeight: 600, color: '#0f1f33', background: '#f0faff', fontSize: 13 }}
        >
          {mesesDisponiveis.map(m => (
            <option key={m} value={m}>{mesLabel(m)}{m === mesAtual ? ' ← atual' : ''}</option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>TMO/VENDAS — {mesLabel(mesSelecionado)}</div>
      <div className="stats-grid">
        {statCard('Total de TMO/Venda', dash.total, 'Registradas')}
        {statCard('Concluídas', dash.concluidas, 'Finalizadas', '#16a34a')}
        {statCard('Pendentes', dash.pendentes, 'Aguardando', '#d97706')}
        {statCard('Canceladas', dash.canceladas, 'Canceladas', '#dc2626')}
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>FINANCEIRO — {mesLabel(mesSelecionado)}</div>
      <div className="stats-grid">
        {statCard('Faturamento Hoje', 'R$ ' + fmt(dash.fatDia))}
        {statCard('Faturamento do Mês', 'R$ ' + fmt(dash.fatMes))}
        {statCard('Faturamento do Ano', 'R$ ' + fmt(dash.fatAno))}
        {statCard('Comissões do Mês (Total)', 'R$ ' + fmt(commissionList.reduce((s, c) => s + c.total, 0)), 'A pagar aos vendedores', '#dc2626')}
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>INDICADORES — {mesLabel(mesSelecionado)}</div>
      <div className="stats-grid">
        {statCard('Ticket Médio', 'R$ ' + fmt(dash.ticket), mesLabel(mesSelecionado))}
        {statCard('Serviço Mais Vendido', dash.maisVendido)}
        {statCard('Melhor Vendedor', dash.melhor)}
      </div>

      {/* PROJEÇÃO DE FECHAMENTO */}
      {dash.total > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem', border: '1px solid rgba(255,176,0,0.3)', background: 'rgba(255,176,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,176,0,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                📈 Projeção de Fechamento — {mesLabel(mesSelecionado)}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                {dash.diasUteisPastados} dias úteis passados · Média de {dash.mediaDiaria.toFixed(1)} TMO/dia · {dash.diasUteisRestantes} dias úteis restantes
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Trabalha aos domingos?</span>
                <button
                  onClick={() => toggleDomingo(true)}
                  style={{ padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: trabalhaDomingo ? '#38bdf8' : 'rgba(255,255,255,0.08)',
                    color: trabalhaDomingo ? '#0f172a' : 'rgba(255,255,255,0.5)' }}
                >Sim</button>
                <button
                  onClick={() => toggleDomingo(false)}
                  style={{ padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: !trabalhaDomingo ? '#38bdf8' : 'rgba(255,255,255,0.08)',
                    color: !trabalhaDomingo ? '#0f172a' : 'rgba(255,255,255,0.5)' }}
                >Não</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Projeção TMO</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#FFB000' }}>{dash.projecaoTotal}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Projeção Faturamento</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>R$ {fmt(dash.projecaoFat)}</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: Math.min((dash.diaAtual / dash.totalDiasMes) * 100, 100) + '%', background: 'linear-gradient(90deg, #FFB000, #FF8C00)', borderRadius: 4, transition: 'width 0.5s' }}></div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Progresso do mês: {Math.round((dash.diaAtual / dash.totalDiasMes) * 100)}% dos dias concluídos</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Faturamento Mensal ({new Date().getFullYear()})</div>
          <BarChart labels={MESES_LABEL} values={dash.fatMensal} />
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Serviços Mais Vendidos — {mesLabel(mesSelecionado)}</div>
          {Object.keys(dash.servCount).length > 0
            ? <DoughnutChart labels={Object.keys(dash.servCount)} values={Object.values(dash.servCount)} />
            : <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>Sem dados neste mês.</p>}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Comissões por Vendedor — {mesLabel(mesSelecionado)}</div>
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


/* ============================================================
   ADMIN — busca os próprios dados (todas as lojas) e renderiza
   ============================================================ */
export default function AdminDashboardPage() {
  const [vendas, setVendas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [comissoes, setComissoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [v, vd, co] = await Promise.all([
          supabase.from('vendas').select('*'),
          supabase.from('vendedores').select('*'),
          supabase.from('comissoes').select('*'),
        ])
        if (v.error) throw v.error
        setVendas(v.data || [])
        setVendedores(vd.data || [])
        setComissoes(co.data || [])
      } catch (e) {
        setErro(e.message || 'Erro ao carregar dados')
      }
      setLoading(false)
    }
    load()
  }, [])

  const btn = (href, icon, label) => (
    <a href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: '#FFB000', color: '#141414', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
      <i className={icon}></i> {label}
    </a>
  )

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'system-ui' }}>Carregando painel admin…</div>
  if (erro) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontFamily: 'system-ui', padding: 24, textAlign: 'center' }}>Erro ao carregar: {erro}</div>

  return (
    <div className="app-container" style={{ padding: 'clamp(12px, 3vw, 32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 900 }}>Painel Admin — LimpAr</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {btn('/admin/visitas', 'fas fa-clipboard-list', 'Visitas')}
          {btn('/admin/benchmark', 'fas fa-chart-line', 'Benchmark')}
          {btn('/admin/fluxo', 'fas fa-car', 'Fluxo de Carros')}
        </div>
      </div>
      <Dashboard vendas={vendas} vendedores={vendedores} comissoes={comissoes} />
    </div>
  )
}

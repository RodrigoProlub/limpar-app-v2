import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import Chart from 'chart.js/auto'

const ADMIN_PASSWORD = 'limpar2026'
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function mesLabel(mes) {
  if (!mes) return '—'
  const [ano, m] = mes.split('-')
  return MESES[Number(m) - 1] + '/' + ano
}

function BarChart({ values }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels: MESES, datasets: [{ label: 'TMO/Venda', data: values, backgroundColor: '#29abe2', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [JSON.stringify(values)])
  return <div style={{ position: 'relative', height: 260 }}><canvas ref={ref}></canvas></div>
}

export default function AdminDashboard() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('limpar_admin_unlocked') === '1')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)
  const [dados, setDados] = useState([]) // dados brutos por cliente (todas as vendas)
  const [porMesGlobal, setPorMesGlobal] = useState(Array(12).fill(0))
  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual)

  const entrar = () => {
    if (senha === ADMIN_PASSWORD) {
      localStorage.setItem('limpar_admin_unlocked', '1')
      setUnlocked(true)
    } else {
      setErro('Senha incorreta.')
    }
  }

  useEffect(() => {
    if (!unlocked) return
    ;(async () => {
      const { data: clientes } = await supabase.from('clientes').select('*').order('nome')
      const year = new Date().getFullYear()

      const resultados = await Promise.all((clientes || []).map(async (c) => {
        const [vRes, cRes] = await Promise.all([
          supabase.from('vendas').select('valor, status, servico, vendedor, data').eq('cliente_id', c.id),
          supabase.from('comissoes').select('vendedor, valor').eq('cliente_id', c.id),
        ])
        const vendas = vRes.data || []
        const comissoesCfg = cRes.data || []

        const porMes = Array(12).fill(0)
        vendas.filter(v => v.status !== 'Cancelado').forEach(v => {
          if (v.data && v.data.startsWith(String(year))) {
            const m = Number(v.data.slice(5, 7)) - 1
            if (m >= 0 && m < 12) porMes[m]++
          }
        })

        return { id: c.id, nome: c.nome, vendas, comissoesCfg, porMes }
      }))

      const global = Array(12).fill(0)
      resultados.forEach(r => r.porMes.forEach((v, i) => { global[i] += v }))
      setPorMesGlobal(global)
      setDados(resultados)
      setLoading(false)
    })()
  }, [unlocked])

  // meses disponíveis (todos que têm venda em qualquer cliente + mês atual)
  const mesesDisponiveis = useMemo(() => {
    const set = new Set([mesAtual])
    dados.forEach(d => d.vendas.forEach(v => { if (v.data) set.add(v.data.slice(0, 7)) }))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [dados, mesAtual])

  // linhas da tabela filtradas pelo mês selecionado
  const linhas = useMemo(() => {
    return dados.map(d => {
      const vendasMes = d.vendas.filter(v => v.data && v.data.startsWith(mesSelecionado))
      const validas = vendasMes.filter(v => v.status !== 'Cancelado')
      const concluidas = vendasMes.filter(v => v.status === 'Concluído')
      const faturamento = validas.reduce((s, v) => s + Number(v.valor || 0), 0)

      const servCount = {}
      validas.forEach(v => { if (v.servico) servCount[v.servico] = (servCount[v.servico] || 0) + 1 })
      const servicoMaisVendido = Object.keys(servCount).sort((a, b) => servCount[b] - servCount[a])[0] || '—'

      const vendCount = {}
      concluidas.forEach(v => { if (v.vendedor) vendCount[v.vendedor] = (vendCount[v.vendedor] || 0) + 1 })
      const melhorVendedor = Object.keys(vendCount).sort((a, b) => vendCount[b] - vendCount[a])[0] || '—'

      const qtdPorVendedor = {}
      concluidas.forEach(v => { qtdPorVendedor[v.vendedor] = (qtdPorVendedor[v.vendedor] || 0) + 1 })
      const comissaoMes = Object.keys(qtdPorVendedor).reduce((s, nome) => {
        const fixo = (d.comissoesCfg.find(cc => cc.vendedor === nome) || {}).valor || 0
        return s + fixo * qtdPorVendedor[nome]
      }, 0)

      return { id: d.id, nome: d.nome, qtdVendas: validas.length, faturamento, servicoMaisVendido, melhorVendedor, comissaoMes }
    }).sort((a, b) => b.qtdVendas - a.qtdVendas)
  }, [dados, mesSelecionado])

  const totalFaturamento = linhas.reduce((s, l) => s + l.faturamento, 0)
  const totalTmo = linhas.reduce((s, l) => s + l.qtdVendas, 0)
  const totalComissao = linhas.reduce((s, l) => s + l.comissaoMes, 0)

  const sair = () => {
    localStorage.removeItem('limpar_admin_unlocked')
    setUnlocked(false)
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-100)', padding: '1rem' }}>
        <div className="card" style={{ width: 360, maxWidth: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img src="/logo.jpeg" alt="LimpAr Auto" style={{ maxWidth: 160, marginBottom: 12 }} />
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Dashboard Geral — Acesso restrito</div>
          </div>
          <input type="password" placeholder="Senha" value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && entrar()}
            style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', marginBottom: 10, boxSizing: 'border-box' }}
          />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={entrar}>Entrar</button>
          {erro && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{erro}</div>}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a href="/" style={{ fontSize: 12, color: 'var(--gray-500)' }}>← Voltar</a>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Carregando dados de todos os clientes...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard Geral — Todos os Clientes</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/" className="btn">← Voltar</a>
          <button className="btn" onClick={sair}>Sair</button>
        </div>
      </div>

      {/* Seletor de mês */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
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
        <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', borderRadius: 6, padding: '4px 10px' }}>
          {totalTmo} TMO · R$ {fmt(totalFaturamento)}
        </span>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'flex', gap: 16, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Faturamento — {mesLabel(mesSelecionado)}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>R$ {fmt(totalFaturamento)}</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>TMO/Venda — {mesLabel(mesSelecionado)}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{totalTmo}</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Clientes Ativos</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{dados.length}</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Comissão — {mesLabel(mesSelecionado)}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>R$ {fmt(totalComissao)}</div>
        </div>
      </div>

      {/* Gráfico anual (não muda com o filtro — visão geral do ano) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>TMO/Venda por Mês — Todos os Clientes ({new Date().getFullYear()})</div>
        <BarChart values={porMesGlobal} />
      </div>

      {/* Tabela filtrada pelo mês */}
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Cliente</th>
                <th>TMO/Venda</th><th>Faturamento</th>
                <th>Serviço Mais Vendido</th><th>Melhor Vendedor</th><th>Comissão do Mês</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Nenhum dado para {mesLabel(mesSelecionado)}.</td></tr>
              ) : linhas.map((l, i) => (
                <tr key={l.id}>
                  <td><b>{i + 1}º</b></td>
                  <td>{l.nome}</td>
                  <td><b>{l.qtdVendas}</b></td>
                  <td><b>R$ {fmt(l.faturamento)}</b></td>
                  <td>{l.servicoMaisVendido}</td>
                  <td>{l.melhorVendedor}</td>
                  <td style={{ color: '#dc2626', fontWeight: 600 }}>R$ {fmt(l.comissaoMes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

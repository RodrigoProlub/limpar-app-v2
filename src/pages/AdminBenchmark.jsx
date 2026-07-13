import { useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { supabase } from '../supabaseClient'

/* ============================================================
   BENCHMARK DE EVOLUÇÃO — /admin/benchmark
   Compara os últimos 6 meses da tabela `vendas` (todas as lojas)
   ============================================================ */

const T = {
  bg: '#0B0D10', panel: '#14171C', panel2: '#181C22', line: '#242932',
  txt: '#E8EAED', sub: '#8B95A5', amber: '#FFB000',
  up: '#3DDC84', down: '#FF6B6B',
}
const PALETA = ['#FFB000', '#5AA9FF', '#3DDC84', '#C084FC', '#FF8FA3', '#7ED4C0', '#F97316', '#38BDF8']
const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const brl = v => 'R$ ' + Math.round(Number(v || 0)).toLocaleString('pt-BR')
const pct = v => (v > 0 ? '+' : '') + Math.round(v) + '%'
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const mesLabel = key => { const [a, m] = key.split('-'); return MESES_LABEL[Number(m) - 1] + '/' + a.slice(2) }

function Ruler({ value, series }) {
  const mn = Math.min(...series), mx = Math.max(...series)
  const posV = mx === mn ? 100 : ((value - mn) / (mx - mn)) * 100
  const posM = mx === mn ? 50 : ((avg(series) - mn) / (mx - mn)) * 100
  return (
    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: T.line, marginTop: 12 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: posV + '%', borderRadius: 3, background: `linear-gradient(90deg, ${T.amber}55, ${T.amber})` }} />
      <div title="média do período" style={{ position: 'absolute', left: posM + '%', top: -3, bottom: -3, width: 2, background: T.txt, opacity: 0.75, borderRadius: 1 }} />
    </div>
  )
}

function Kpi({ label, series, idx, fmt = v => v }) {
  const cur = series[idx]
  const prev = idx > 0 ? series[idx - 1] : null
  const media = avg(series)
  const dMoM = prev ? ((cur - prev) / prev) * 100 : null
  const dBench = media ? ((cur - media) / media) * 100 : 0
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.sub, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: T.txt, marginTop: 6, lineHeight: 1.1 }}>{fmt(cur)}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {dMoM !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: (dMoM >= 0 ? T.up : T.down) + '22', color: dMoM >= 0 ? T.up : T.down }}>
            {pct(dMoM)} vs mês ant.
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: T.line, color: dBench >= 0 ? T.up : T.down }}>
          {pct(dBench)} vs média
        </span>
      </div>
      <Ruler value={cur} series={series} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.sub, marginTop: 4 }}>
        <span>{fmt(Math.min(...series))}</span>
        <span style={{ opacity: 0.8 }}>│ média {fmt(avg(series))}</span>
        <span>{fmt(Math.max(...series))}</span>
      </div>
    </div>
  )
}

function ChartBox({ build, deps, height = 260 }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, build())
    return () => { if (chartRef.current) chartRef.current.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return <div style={{ position: 'relative', height }}><canvas ref={canvasRef}></canvas></div>
}

export default function AdminBenchmark() {
  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [carteira, setCarteira] = useState([])
  const [fluxo, setFluxo] = useState([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    async function load() {
      const [v, c, cc, fl] = await Promise.all([
        supabase.from('vendas').select('cliente, cliente_id, data, servico, status, valor'),
        supabase.from('clientes').select('*'),
        supabase.from('carteira_clientes').select('id, nome'),
        supabase.from('fluxo_lojas').select('carteira_cliente_id, mes, carros'),
      ])
      if (v.data) setVendas(v.data.filter(x => x.status !== 'Cancelado' && x.data))
      if (c.data) setClientes(c.data)
      if (cc.data) setCarteira(cc.data)
      if (fl.data) setFluxo(fl.data)
      setLoading(false)
    }
    load()
  }, [])

  const nomeCliente = useMemo(() => {
    const map = {}
    clientes.forEach(c => { map[c.id] = c.nome || c.codigo || ('Loja ' + c.id) })
    return map
  }, [clientes])

  // liga o texto livre de vendas.cliente com carteira_clientes pelo nome normalizado
  const carteiraPorNome = useMemo(() => {
    const map = {}
    carteira.forEach(c => { map[slug(c.nome)] = c.id })
    return map
  }, [carteira])

  // fluxo indexado: { 'carteiraId|YYYY-MM': carros }
  const fluxoMap = useMemo(() => {
    const map = {}
    fluxo.forEach(f => { map[f.carteira_cliente_id + '|' + f.mes] = f.carros })
    return map
  }, [fluxo])

  // Últimos 6 meses com movimento (ou menos, se o histórico for curto)
  const meses = useMemo(() => {
    const set = new Set(vendas.map(v => v.data.slice(0, 7)))
    return [...set].sort().slice(-6)
  }, [vendas])

  useEffect(() => { if (meses.length) setIdx(meses.length - 1) }, [meses.length])

  const agg = useMemo(() => {
    const porMes = meses.map(() => ({ rev: 0, qtd: 0, lojas: new Set() }))
    const porServico = {}
    const porLoja = {}   // chave = nome da loja (texto de vendas.cliente)
    vendas.forEach(v => {
      const mi = meses.indexOf(v.data.slice(0, 7))
      if (mi === -1) return
      const val = Number(v.valor || 0)
      const loja = v.cliente || 'Sem loja'
      porMes[mi].rev += val
      porMes[mi].qtd += 1
      porMes[mi].lojas.add(loja)
      const s = v.servico || 'Outros'
      if (!porServico[s]) porServico[s] = meses.map(() => 0)
      porServico[s][mi] += val
      if (!porLoja[loja]) porLoja[loja] = { rev: meses.map(() => 0), qtd: meses.map(() => 0) }
      porLoja[loja].rev[mi] += val
      porLoja[loja].qtd[mi] += 1
    })

    // carros por mês = soma do fluxo apenas das lojas que tiveram serviço no mês
    const carrosMes = meses.map((m, mi) => {
      let soma = 0
      Object.keys(porLoja).forEach(loja => {
        if (porLoja[loja].qtd[mi] > 0) {
          const cid = carteiraPorNome[slug(loja)]
          if (cid) soma += Number(fluxoMap[cid + '|' + m] || 0)
        }
      })
      return soma
    })
    const servicosMes = meses.map((_, mi) => porMes[mi].qtd)

    return { porMes, porServico, porLoja, carrosMes, servicosMes }
  }, [vendas, meses, carteiraPorNome, fluxoMap])

  if (loading) return <div style={{ minHeight: '100vh', background: T.bg, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Carregando benchmark…</div>

  if (!meses.length) return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.txt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', textAlign: 'center', padding: 24 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Sem vendas registradas ainda</div>
        <div style={{ color: T.sub, marginTop: 8 }}>Assim que as lojas lançarem TMO/Vendas, o benchmark aparece aqui.</div>
      </div>
    </div>
  )

  const revS = agg.porMes.map(d => d.rev)
  const qtdS = agg.porMes.map(d => d.qtd)
  const lojasS = agg.porMes.map(d => d.lojas.size)
  const ticketS = agg.porMes.map(d => (d.lojas.size ? d.rev / d.lojas.size : 0))
  const medioS = agg.porMes.map(d => (d.qtd ? d.rev / d.qtd : 0))
  // aproveitamento = serviços feitos ÷ carros que passaram (só lojas com fluxo lançado)
  const aprovS = meses.map((_, i) => (agg.carrosMes[i] ? (100 * agg.servicosMes[i]) / agg.carrosMes[i] : 0))
  const temFluxo = agg.carrosMes.some(c => c > 0)
  const revBench = avg(revS)

  const servicosOrd = Object.entries(agg.porServico).sort((a, b) => avg(b[1]) * b[1].length - avg(a[1]) * a[1].length)
  const revMaxLoja = Math.max(...Object.values(agg.porLoja).map(o => Math.max(...o.rev)), 1)

  const ranking = Object.entries(agg.porLoja).map(([loja, o]) => {
    const serie = o.rev
    const cur = serie[idx]
    const prev = idx > 0 ? serie[idx - 1] : 0
    const first = serie.findIndex(v => v > 0)
    let status, cor
    if (cur === 0 && prev > 0) { status = 'parou'; cor = T.down }
    else if (cur === 0) { status = 'inativa'; cor = T.sub }
    else if (first === idx) { status = 'nova'; cor = T.amber }
    else if (cur > prev) { status = 'subindo'; cor = T.up }
    else if (cur < prev) { status = 'caindo'; cor = T.down }
    else { status = 'estável'; cor = T.sub }
    // aproveitamento da loja no mês
    const cid = carteiraPorNome[slug(loja)]
    const carros = cid ? Number(fluxoMap[cid + '|' + meses[idx]] || 0) : 0
    const servicos = o.qtd[idx]
    const aprov = carros > 0 ? (100 * servicos) / carros : null
    return { loja, nome: loja, serie, cur, status, cor, carros, servicos, aprov, semCadastro: !cid }
  }).sort((a, b) => b.cur - a.cur)

  const aprovOrd = ranking.filter(r => r.aprov !== null && r.servicos > 0).sort((a, b) => b.aprov - a.aprov)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.txt, fontFamily: 'system-ui, sans-serif', padding: '24px clamp(12px, 3vw, 40px) 60px' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: T.amber, fontWeight: 700, textTransform: 'uppercase' }}>
            LimpAr Gestão Comercial · Admin
          </div>
          <h1 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 900, margin: '6px 0 0', lineHeight: 1.05 }}>
            Benchmark de Evolução <span style={{ color: T.amber }}>{mesLabel(meses[0])} – {mesLabel(meses[meses.length - 1])}</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 6, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: 6, flexWrap: 'wrap' }}>
          {meses.map((m, i) => (
            <button key={m} onClick={() => setIdx(i)}
              style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '8px 13px', fontWeight: 700, fontSize: 13, background: i === idx ? T.amber : 'transparent', color: i === idx ? '#141414' : T.sub }}>
              {mesLabel(m)}
            </button>
          ))}
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <Kpi label="Faturamento" series={revS} idx={idx} fmt={brl} />
        <Kpi label="TMO / Vendas" series={qtdS} idx={idx} fmt={v => Math.round(v)} />
        <Kpi label="Lojas ativas" series={lojasS} idx={idx} fmt={v => Math.round(v)} />
        <Kpi label="Ticket médio · loja" series={ticketS} idx={idx} fmt={brl} />
        <Kpi label="Valor médio · TMO" series={medioS} idx={idx} fmt={v => 'R$ ' + Number(v).toFixed(0)} />
        {temFluxo
          ? <Kpi label="% Aproveitamento" series={aprovS} idx={idx} fmt={v => Number(v).toFixed(1) + '%'} />
          : (
            <a href="/admin/fluxo" style={{ background: T.panel, border: `1px dashed ${T.amber}66`, borderRadius: 14, padding: '16px 18px', textDecoration: 'none', display: 'block' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.amber, fontWeight: 600 }}>% Aproveitamento</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.txt, marginTop: 8, lineHeight: 1.3 }}>Lançar fluxo de carros →</div>
              <div style={{ fontSize: 11.5, color: T.sub, marginTop: 6 }}>Sem o fluxo mensal, não dá para calcular o aproveitamento.</div>
            </a>
          )}
      </section>

      <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: '18px 14px 10px', marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '0 4px 10px' }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Faturamento mensal × benchmark</div>
          <div style={{ fontSize: 12, color: T.sub }}>linha tracejada = média do período ({brl(revBench)})</div>
        </div>
        <ChartBox deps={[meses.join(), idx, revS.join()]} build={() => ({
          type: 'bar',
          data: {
            labels: meses.map(mesLabel),
            datasets: [
              { type: 'bar', label: 'Faturamento', data: revS, backgroundColor: revS.map((_, i) => i === idx ? '#FFB000' : '#FFB00055'), borderRadius: 6 },
              { type: 'line', label: 'Média do período', data: revS.map(() => revBench), borderColor: '#E8EAED', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (_, els) => { if (els.length) setIdx(els[0].index) },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + brl(c.parsed.y) } } },
            scales: {
              x: { grid: { display: false }, ticks: { color: T.sub } },
              y: { beginAtZero: true, grid: { color: T.line }, ticks: { color: T.sub, callback: v => (v / 1000).toFixed(0) + 'k' } },
            },
          },
        })} />
      </section>

      <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: '18px 14px 10px', marginTop: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 15, padding: '0 4px 10px' }}>Mix de serviços — receita por mês</div>
        <ChartBox deps={[meses.join(), JSON.stringify(agg.porServico)]} build={() => ({
          type: 'bar',
          data: {
            labels: meses.map(mesLabel),
            datasets: servicosOrd.map(([s, serie], i) => ({ label: s, data: serie, backgroundColor: PALETA[i % PALETA.length], stack: 'mix', borderRadius: 3 })),
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: T.sub, boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + brl(c.parsed.y) } } },
            scales: {
              x: { stacked: true, grid: { display: false }, ticks: { color: T.sub } },
              y: { stacked: true, beginAtZero: true, grid: { color: T.line }, ticks: { color: T.sub, callback: v => (v / 1000).toFixed(0) + 'k' } },
            },
          },
        })} />
      </section>

      {/* APROVEITAMENTO POR LOJA */}
      {aprovOrd.length > 0 && (
        <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Aproveitamento por loja — {mesLabel(meses[idx])}</div>
            <a href="/admin/fluxo" style={{ fontSize: 12, color: T.amber, textDecoration: 'none', fontWeight: 700 }}>Lançar fluxo →</a>
          </div>
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 14 }}>
            serviços feitos ÷ carros que passaram · média geral: <strong style={{ color: T.txt }}>{aprovS[idx].toFixed(1)}%</strong>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {aprovOrd.map(r => {
              const escala = Math.max(...aprovOrd.map(x => x.aprov), 1)
              const acima = r.aprov >= aprovS[idx]
              return (
                <div key={r.loja} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.4fr) 2fr auto auto', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10, background: T.panel2, border: `1px solid ${T.line}` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</div>
                  <div style={{ height: 8, borderRadius: 4, background: T.line, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, width: (r.aprov / escala) * 100 + '%', borderRadius: 4, background: acima ? `linear-gradient(90deg, ${T.up}66, ${T.up})` : `linear-gradient(90deg, ${T.down}66, ${T.down})` }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.sub, minWidth: 92, textAlign: 'right' }}>{r.servicos} / {r.carros.toLocaleString('pt-BR')} carros</div>
                  <div style={{ fontWeight: 900, fontSize: 14, minWidth: 56, textAlign: 'right', color: acima ? T.up : T.down }}>{r.aprov.toFixed(1)}%</div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Ranking de lojas — {mesLabel(meses[idx])}</div>
          <div style={{ fontSize: 12, color: T.sub }}>status comparado ao mês anterior</div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {ranking.map(r => (
            <div key={r.loja} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.4fr) 2fr auto auto auto', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10, background: r.cur > 0 ? T.panel2 : 'transparent', border: `1px solid ${r.cur > 0 ? T.line : 'transparent'}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.cur > 0 ? T.txt : T.sub }}>{r.nome}</div>
                {r.semCadastro && <div style={{ fontSize: 10, color: T.sub }}>sem par na carteira</div>}
              </div>
              <div style={{ height: 8, borderRadius: 4, background: T.line, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, width: (r.cur / revMaxLoja) * 100 + '%', borderRadius: 4, background: r.cur > 0 ? `linear-gradient(90deg, ${T.amber}66, ${T.amber})` : 'transparent' }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, minWidth: 46, textAlign: 'right', color: r.aprov !== null ? (r.aprov >= aprovS[idx] ? T.up : T.down) : T.line }}>
                {r.aprov !== null ? r.aprov.toFixed(1) + '%' : '—'}
              </div>
              <div style={{ fontWeight: 900, fontSize: 13, minWidth: 74, textAlign: 'right', color: r.cur > 0 ? T.txt : T.sub }}>{brl(r.cur)}</div>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 9px', borderRadius: 999, background: r.cor + '22', color: r.cor, minWidth: 60, textAlign: 'center' }}>{r.status}</span>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: 18, fontSize: 11, color: T.sub, lineHeight: 1.6 }}>
        Fonte: tabela <code>vendas</code> (status ≠ Cancelado), agrupada por mês. Benchmark = média simples dos últimos {meses.length} meses.
        Ticket médio = faturamento ÷ lojas ativas no mês. Valor médio = faturamento ÷ quantidade de TMO/vendas.
        Aproveitamento = serviços feitos ÷ carros que passaram (fluxo lançado em /admin/fluxo); considera apenas lojas com fluxo informado no mês.
      </footer>
    </div>
  )
}

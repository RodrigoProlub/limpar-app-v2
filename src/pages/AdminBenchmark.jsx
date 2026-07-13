import { useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { supabase } from '../supabaseClient'

/* BENCHMARK DE EVOLUÇÃO — /admin/benchmark
   Lê faturamento_lojas (consolidado por loja/mês/serviço) + fluxo_lojas */

const T = { bg:'#0B0D10', panel:'#14171C', panel2:'#181C22', line:'#242932',
  txt:'#E8EAED', sub:'#8B95A5', amber:'#FFB000', up:'#3DDC84', down:'#FF6B6B' }
const PALETA = ['#FFB000','#5AA9FF','#3DDC84','#C084FC','#FF8FA3','#7ED4C0','#F97316','#38BDF8']
const ML = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const brl = v => 'R$ ' + Math.round(Number(v||0)).toLocaleString('pt-BR')
const pct = v => (v > 0 ? '+' : '') + Math.round(v) + '%'
const avg = a => (a.length ? a.reduce((s,x) => s+x, 0) / a.length : 0)
const mesLabel = k => { const [a,m] = k.split('-'); return ML[Number(m)-1] + '/' + a.slice(2) }

function Ruler({ value, series }) {
  const mn = Math.min(...series), mx = Math.max(...series)
  const posV = mx === mn ? 100 : ((value-mn)/(mx-mn))*100
  const posM = mx === mn ? 50 : ((avg(series)-mn)/(mx-mn))*100
  return (
    <div style={{ position:'relative', height:6, borderRadius:3, background:T.line, marginTop:12 }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:posV+'%', borderRadius:3, background:`linear-gradient(90deg, ${T.amber}55, ${T.amber})` }} />
      <div title="média do período" style={{ position:'absolute', left:posM+'%', top:-3, bottom:-3, width:2, background:T.txt, opacity:.75, borderRadius:1 }} />
    </div>
  )
}

function Kpi({ label, series, idx, fmt = v => v }) {
  const cur = series[idx]
  const prev = idx > 0 ? series[idx-1] : null
  const media = avg(series)
  const dMoM = prev ? ((cur-prev)/prev)*100 : null
  const dBench = media ? ((cur-media)/media)*100 : 0
  return (
    <div style={{ background:T.panel, border:`1px solid ${T.line}`, borderRadius:14, padding:'16px 18px' }}>
      <div style={{ fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', color:T.sub, fontWeight:600 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:900, color:T.txt, marginTop:6, lineHeight:1.1 }}>{fmt(cur)}</div>
      <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
        {dMoM !== null && (
          <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:999,
            background:(dMoM>=0?T.up:T.down)+'22', color: dMoM>=0?T.up:T.down }}>{pct(dMoM)} vs mês ant.</span>
        )}
        <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:999, background:T.line,
          color: dBench>=0?T.up:T.down }}>{pct(dBench)} vs média</span>
      </div>
      <Ruler value={cur} series={series} />
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:T.sub, marginTop:4 }}>
        <span>{fmt(Math.min(...series))}</span><span style={{opacity:.8}}>│ média {fmt(avg(series))}</span><span>{fmt(Math.max(...series))}</span>
      </div>
    </div>
  )
}

function ChartBox({ build, deps, height = 260 }) {
  const cv = useRef(null), ch = useRef(null)
  useEffect(() => {
    if (ch.current) ch.current.destroy()
    ch.current = new Chart(cv.current, build())
    return () => { if (ch.current) ch.current.destroy() }
  }, deps)
  return <div style={{ position:'relative', height }}><canvas ref={cv}></canvas></div>
}

export default function AdminBenchmark() {
  const [fat, setFat] = useState([])
  const [fluxo, setFluxo] = useState([])
  const [lojas, setLojas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [vendedorId, setVendedorId] = useState(1)
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    async function load() {
      const [f, fl, cc, vd] = await Promise.all([
        supabase.from('faturamento_lojas').select('carteira_cliente_id, mes, servico, qtd, valor_total'),
        supabase.from('fluxo_lojas').select('carteira_cliente_id, mes, carros'),
        supabase.from('carteira_clientes').select('id, nome, vendedor_id'),
        supabase.from('carteira_vendedores').select('id, nome').order('id'),
      ])
      setFat(f.data || []); setFluxo(fl.data || [])
      setLojas(cc.data || []); setVendedores(vd.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const lojaInfo = useMemo(() => {
    const m = {}
    lojas.forEach(l => { m[l.id] = l })
    return m
  }, [lojas])

  // só o faturamento das lojas do vendedor selecionado
  const fatV = useMemo(() =>
    fat.filter(f => lojaInfo[f.carteira_cliente_id]?.vendedor_id === vendedorId),
    [fat, lojaInfo, vendedorId])

  const meses = useMemo(() => {
    const s = new Set(fatV.map(f => f.mes))
    return [...s].sort().slice(-6)
  }, [fatV])

  useEffect(() => { if (meses.length) setIdx(meses.length - 1) }, [meses.length])

  const fluxoMap = useMemo(() => {
    const m = {}
    fluxo.forEach(f => { m[f.carteira_cliente_id + '|' + f.mes] = f.carros })
    return m
  }, [fluxo])

  const agg = useMemo(() => {
    const porMes = meses.map(() => ({ rev:0, qtd:0, lojas:new Set() }))
    const porServico = {}
    const porLoja = {}
    fatV.forEach(f => {
      const mi = meses.indexOf(f.mes)
      if (mi === -1) return
      const val = Number(f.valor_total || 0), q = Number(f.qtd || 0)
      porMes[mi].rev += val; porMes[mi].qtd += q; porMes[mi].lojas.add(f.carteira_cliente_id)
      const s = f.servico || 'Outros'
      if (!porServico[s]) porServico[s] = meses.map(() => 0)
      porServico[s][mi] += val
      const cid = f.carteira_cliente_id
      if (!porLoja[cid]) porLoja[cid] = { rev: meses.map(()=>0), qtd: meses.map(()=>0) }
      porLoja[cid].rev[mi] += val; porLoja[cid].qtd[mi] += q
    })
    const carrosMes = meses.map((m, mi) => {
      let soma = 0
      Object.keys(porLoja).forEach(cid => {
        if (porLoja[cid].qtd[mi] > 0) soma += Number(fluxoMap[cid + '|' + m] || 0)
      })
      return soma
    })
    return { porMes, porServico, porLoja, carrosMes }
  }, [fatV, meses, fluxoMap])

  if (loading) return <div style={{ minHeight:'100vh', background:T.bg, color:T.sub, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui' }}>Carregando benchmark…</div>

  if (!meses.length) return (
    <div style={{ minHeight:'100vh', background:T.bg, color:T.txt, fontFamily:'system-ui', padding:'40px 24px', textAlign:'center' }}>
      <a href="/admin" style={{ fontSize:12, color:T.sub, textDecoration:'none' }}>← Voltar ao painel</a>
      <div style={{ marginTop:60, fontSize:20, fontWeight:900 }}>Sem faturamento para este vendedor</div>
      <div style={{ color:T.sub, marginTop:8 }}>Selecione outro vendedor ou importe os dados.</div>
      <select value={vendedorId} onChange={e => setVendedorId(Number(e.target.value))}
        style={{ marginTop:20, padding:'10px 14px', borderRadius:10, border:`1px solid ${T.amber}66`, background:T.panel, color:T.txt, fontWeight:700 }}>
        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
      </select>
    </div>
  )

  const revS = agg.porMes.map(d => d.rev)
  const qtdS = agg.porMes.map(d => d.qtd)
  const lojasS = agg.porMes.map(d => d.lojas.size)
  const ticketS = agg.porMes.map(d => (d.lojas.size ? d.rev/d.lojas.size : 0))
  const medioS = agg.porMes.map(d => (d.qtd ? d.rev/d.qtd : 0))
  const aprovS = meses.map((_,i) => (agg.carrosMes[i] ? (100*agg.porMes[i].qtd)/agg.carrosMes[i] : 0))
  const temFluxo = agg.carrosMes.some(c => c > 0)
  const revBench = avg(revS)

  const servicosOrd = Object.entries(agg.porServico)
    .sort((a,b) => b[1].reduce((s,x)=>s+x,0) - a[1].reduce((s,x)=>s+x,0))
  const revMaxLoja = Math.max(...Object.values(agg.porLoja).map(o => Math.max(...o.rev)), 1)

  const ranking = Object.entries(agg.porLoja).map(([cid, o]) => {
    const serie = o.rev
    const cur = serie[idx], prev = idx > 0 ? serie[idx-1] : 0
    const first = serie.findIndex(v => v > 0)
    let status, cor
    if (cur === 0 && prev > 0) { status='parou'; cor=T.down }
    else if (cur === 0) { status='inativa'; cor=T.sub }
    else if (first === idx) { status='nova'; cor=T.amber }
    else if (cur > prev) { status='subindo'; cor=T.up }
    else if (cur < prev) { status='caindo'; cor=T.down }
    else { status='estável'; cor=T.sub }
    const carros = Number(fluxoMap[cid + '|' + meses[idx]] || 0)
    const servicos = o.qtd[idx]
    const aprov = carros > 0 ? (100*servicos)/carros : null
    return { cid, nome: lojaInfo[cid]?.nome || ('Loja ' + cid), cur, status, cor, carros, servicos, aprov }
  }).sort((a,b) => b.cur - a.cur)

  const aprovOrd = ranking.filter(r => r.aprov !== null && r.servicos > 0).sort((a,b) => b.aprov - a.aprov)

  return (
    <div style={{ minHeight:'100vh', background:T.bg, color:T.txt, fontFamily:'system-ui, sans-serif', padding:'24px clamp(12px,3vw,40px) 60px' }}>
      <header style={{ marginBottom:22 }}>
        <a href="/admin" style={{ fontSize:12, color:T.sub, textDecoration:'none' }}>← Voltar ao painel</a>
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', justifyContent:'space-between', gap:16, marginTop:12 }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:'0.14em', color:T.amber, fontWeight:700, textTransform:'uppercase' }}>LimpAr · Gestão Comercial</div>
            <h1 style={{ fontSize:'clamp(22px,4vw,32px)', fontWeight:900, margin:'6px 0 0', lineHeight:1.05 }}>
              Benchmark <span style={{ color:T.amber }}>{mesLabel(meses[0])} – {mesLabel(meses[meses.length-1])}</span>
            </h1>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <select value={vendedorId} onChange={e => setVendedorId(Number(e.target.value))}
              style={{ padding:'9px 13px', borderRadius:10, border:`1px solid ${T.amber}66`, background:T.panel, color:T.txt, fontWeight:700, fontSize:13 }}>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
            <div style={{ display:'flex', gap:5, background:T.panel, border:`1px solid ${T.line}`, borderRadius:12, padding:5, flexWrap:'wrap' }}>
              {meses.map((m,i) => (
                <button key={m} onClick={() => setIdx(i)}
                  style={{ border:'none', cursor:'pointer', borderRadius:8, padding:'7px 11px', fontWeight:700, fontSize:12.5,
                    background: i===idx ? T.amber : 'transparent', color: i===idx ? '#141414' : T.sub }}>{mesLabel(m)}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(205px,1fr))', gap:12 }}>
        <Kpi label="Faturamento" series={revS} idx={idx} fmt={brl} />
        <Kpi label="Aplicações" series={qtdS} idx={idx} fmt={v => Math.round(v)} />
        <Kpi label="Lojas ativas" series={lojasS} idx={idx} fmt={v => Math.round(v)} />
        <Kpi label="Ticket médio · loja" series={ticketS} idx={idx} fmt={brl} />
        <Kpi label="Preço médio · aplicação" series={medioS} idx={idx} fmt={v => 'R$ ' + Number(v).toFixed(0)} />
        {temFluxo
          ? <Kpi label="% Aproveitamento" series={aprovS} idx={idx} fmt={v => Number(v).toFixed(1) + '%'} />
          : (
            <a href="/admin/fluxo" style={{ background:T.panel, border:`1px dashed ${T.amber}66`, borderRadius:14, padding:'16px 18px', textDecoration:'none', display:'block' }}>
              <div style={{ fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', color:T.amber, fontWeight:600 }}>% Aproveitamento</div>
              <div style={{ fontSize:15, fontWeight:800, color:T.txt, marginTop:8 }}>Lançar fluxo de carros →</div>
              <div style={{ fontSize:11.5, color:T.sub, marginTop:6 }}>Sem o fluxo mensal não dá para calcular.</div>
            </a>
          )}
      </section>

      <section style={{ background:T.panel, border:`1px solid ${T.line}`, borderRadius:14, padding:'18px 14px 10px', marginTop:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, padding:'0 4px 10px' }}>
          <div style={{ fontWeight:900, fontSize:15 }}>Faturamento mensal × benchmark</div>
          <div style={{ fontSize:12, color:T.sub }}>linha tracejada = média ({brl(revBench)})</div>
        </div>
        <ChartBox deps={[meses.join(), idx, revS.join()]} build={() => ({
          type:'bar',
          data:{ labels: meses.map(mesLabel), datasets:[
            { type:'bar', label:'Faturamento', data:revS, backgroundColor:revS.map((_,i)=> i===idx?'#FFB000':'#FFB00055'), borderRadius:6 },
            { type:'line', label:'Média', data:revS.map(()=>revBench), borderColor:'#E8EAED', borderDash:[5,5], borderWidth:1.5, pointRadius:0 },
          ]},
          options:{ responsive:true, maintainAspectRatio:false,
            onClick:(_,els)=>{ if(els.length) setIdx(els[0].index) },
            plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c => c.dataset.label+': '+brl(c.parsed.y) } } },
            scales:{ x:{grid:{display:false}, ticks:{color:T.sub}},
                     y:{beginAtZero:true, grid:{color:T.line}, ticks:{color:T.sub, callback:v=>(v/1000).toFixed(0)+'k'}} } },
        })} />
      </section>

      <section style={{ background:T.panel, border:`1px solid ${T.line}`, borderRadius:14, padding:'18px 14px 10px', marginTop:16 }}>
        <div style={{ fontWeight:900, fontSize:15, padding:'0 4px 10px' }}>Mix de serviços — receita por mês</div>
        <ChartBox deps={[meses.join(), JSON.stringify(agg.porServico)]} build={() => ({
          type:'bar',
          data:{ labels: meses.map(mesLabel),
            datasets: servicosOrd.map(([s,serie],i) => ({ label:s, data:serie, backgroundColor:PALETA[i%PALETA.length], stack:'mix', borderRadius:3 })) },
          options:{ responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{position:'bottom', labels:{color:T.sub, boxWidth:10, font:{size:11}}},
                      tooltip:{ callbacks:{ label:c => c.dataset.label+': '+brl(c.parsed.y) } } },
            scales:{ x:{stacked:true, grid:{display:false}, ticks:{color:T.sub}},
                     y:{stacked:true, beginAtZero:true, grid:{color:T.line}, ticks:{color:T.sub, callback:v=>(v/1000).toFixed(0)+'k'}} } },
        })} />
      </section>

      {aprovOrd.length > 0 && (
        <section style={{ background:T.panel, border:`1px solid ${T.line}`, borderRadius:14, padding:18, marginTop:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:6 }}>
            <div style={{ fontWeight:900, fontSize:15 }}>Aproveitamento por loja — {mesLabel(meses[idx])}</div>
            <a href="/admin/fluxo" style={{ fontSize:12, color:T.amber, textDecoration:'none', fontWeight:700 }}>Lançar fluxo →</a>
          </div>
          <div style={{ fontSize:12, color:T.sub, marginBottom:14 }}>
            aplicações ÷ carros que passaram · média: <strong style={{color:T.txt}}>{aprovS[idx].toFixed(1)}%</strong>
          </div>
          <div style={{ display:'grid', gap:8 }}>
            {aprovOrd.map(r => {
              const escala = Math.max(...aprovOrd.map(x => x.aprov), 1)
              const acima = r.aprov >= aprovS[idx]
              return (
                <div key={r.cid} style={{ display:'grid', gridTemplateColumns:'minmax(120px,1.4fr) 2fr auto auto', alignItems:'center', gap:12, padding:'8px 10px', borderRadius:10, background:T.panel2, border:`1px solid ${T.line}` }}>
                  <div style={{ fontSize:12.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.nome}</div>
                  <div style={{ height:8, borderRadius:4, background:T.line, position:'relative' }}>
                    <div style={{ position:'absolute', inset:0, width:(r.aprov/escala)*100+'%', borderRadius:4,
                      background: acima ? `linear-gradient(90deg, ${T.up}66, ${T.up})` : `linear-gradient(90deg, ${T.down}66, ${T.down})` }} />
                  </div>
                  <div style={{ fontSize:11, color:T.sub, minWidth:92, textAlign:'right' }}>{r.servicos} / {r.carros.toLocaleString('pt-BR')} carros</div>
                  <div style={{ fontWeight:900, fontSize:14, minWidth:56, textAlign:'right', color: acima?T.up:T.down }}>{r.aprov.toFixed(1)}%</div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section style={{ background:T.panel, border:`1px solid ${T.line}`, borderRadius:14, padding:18, marginTop:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          <div style={{ fontWeight:900, fontSize:15 }}>Ranking de lojas — {mesLabel(meses[idx])}</div>
          <div style={{ fontSize:12, color:T.sub }}>status vs. mês anterior</div>
        </div>
        <div style={{ display:'grid', gap:8 }}>
          {ranking.map(r => (
            <div key={r.cid} style={{ display:'grid', gridTemplateColumns:'minmax(120px,1.4fr) 2fr auto auto auto', alignItems:'center', gap:12, padding:'8px 10px', borderRadius:10,
              background: r.cur>0 ? T.panel2 : 'transparent', border:`1px solid ${r.cur>0 ? T.line : 'transparent'}` }}>
              <div style={{ fontSize:12.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: r.cur>0?T.txt:T.sub }}>{r.nome}</div>
              <div style={{ height:8, borderRadius:4, background:T.line, position:'relative' }}>
                <div style={{ position:'absolute', inset:0, width:(r.cur/revMaxLoja)*100+'%', borderRadius:4,
                  background: r.cur>0 ? `linear-gradient(90deg, ${T.amber}66, ${T.amber})` : 'transparent' }} />
              </div>
              <div style={{ fontSize:11, fontWeight:700, minWidth:46, textAlign:'right',
                color: r.aprov!==null ? (r.aprov>=aprovS[idx]?T.up:T.down) : T.line }}>
                {r.aprov !== null ? r.aprov.toFixed(1)+'%' : '—'}
              </div>
              <div style={{ fontWeight:900, fontSize:13, minWidth:74, textAlign:'right', color: r.cur>0?T.txt:T.sub }}>{brl(r.cur)}</div>
              <span style={{ fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', padding:'3px 9px', borderRadius:999,
                background:r.cor+'22', color:r.cor, minWidth:60, textAlign:'center' }}>{r.status}</span>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop:18, fontSize:11, color:T.sub, lineHeight:1.6 }}>
        Fonte: faturamento consolidado por loja/mês/serviço. Benchmark = média dos últimos {meses.length} meses.
        Ticket médio = faturamento ÷ lojas ativas. Preço médio = faturamento ÷ aplicações.
        Aproveitamento = aplicações ÷ carros que passaram (lançado em <a href="/admin/fluxo" style={{color:T.amber}}>/admin/fluxo</a>); considera apenas lojas com fluxo informado.
      </footer>
    </div>
  )
}

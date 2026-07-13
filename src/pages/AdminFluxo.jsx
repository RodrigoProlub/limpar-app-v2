import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

/* ============================================================
   FLUXO DE CARROS — /admin/fluxo
   Lançamento manual mensal da passagem de veículos por loja
   ============================================================ */

const T = {
  bg: '#0B0D10', panel: '#14171C', panel2: '#181C22', line: '#242932',
  txt: '#E8EAED', sub: '#8B95A5', amber: '#FFB000', up: '#3DDC84', down: '#FF6B6B',
}
const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const mesLabel = k => { const [a, m] = k.split('-'); return MESES_LABEL[Number(m) - 1] + '/' + a.slice(2) }

// gera os últimos 12 meses (mais recente primeiro)
function ultimosMeses(n = 12) {
  const out = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

export default function AdminFluxo() {
  const meses = useMemo(() => ultimosMeses(12), [])
  const [mes, setMes] = useState(meses[0])
  const [lojas, setLojas] = useState([])
  const [fluxo, setFluxo] = useState({})       // { [lojaId]: carros }
  const [original, setOriginal] = useState({}) // para saber o que mudou
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  // carrega lojas ativas
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('carteira_clientes')
        .select('id, nome, bairro, situacao')
        .eq('ativo', true)
        .order('nome')
      setLojas(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // carrega o fluxo do mês selecionado
  useEffect(() => {
    async function loadMes() {
      const { data } = await supabase
        .from('fluxo_lojas')
        .select('carteira_cliente_id, carros')
        .eq('mes', mes)
      const map = {}
      ;(data || []).forEach(r => { map[r.carteira_cliente_id] = String(r.carros) })
      setFluxo(map)
      setOriginal(map)
      setMsg(null)
    }
    loadMes()
  }, [mes])

  const lojasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return lojas
    return lojas.filter(l => (l.nome || '').toLowerCase().includes(q) || (l.bairro || '').toLowerCase().includes(q))
  }, [lojas, busca])

  const alterados = useMemo(() => {
    return Object.keys(fluxo).filter(id => (fluxo[id] || '') !== (original[id] || '') && fluxo[id] !== '')
  }, [fluxo, original])

  const preenchidas = Object.values(fluxo).filter(v => v !== '' && Number(v) > 0).length
  const totalCarros = Object.values(fluxo).reduce((s, v) => s + (Number(v) || 0), 0)

  async function salvar() {
    if (!alterados.length) return
    setSalvando(true)
    setMsg(null)
    const rows = alterados.map(id => ({
      carteira_cliente_id: Number(id),
      mes,
      carros: Number(fluxo[id]) || 0,
    }))
    const { error } = await supabase
      .from('fluxo_lojas')
      .upsert(rows, { onConflict: 'carteira_cliente_id,mes' })
    if (error) {
      setMsg({ tipo: 'erro', txt: 'Erro ao salvar: ' + error.message })
    } else {
      setOriginal({ ...fluxo })
      setMsg({ tipo: 'ok', txt: `${rows.length} loja(s) salva(s) em ${mesLabel(mes)}.` })
    }
    setSalvando(false)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: T.bg, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Carregando lojas…</div>

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.txt, fontFamily: 'system-ui, sans-serif', padding: '24px clamp(12px, 3vw, 40px) 120px' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <a href="/admin" style={{ fontSize: 12, color: T.sub, textDecoration: 'none' }}>← Voltar ao painel</a>
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: T.amber, fontWeight: 700, textTransform: 'uppercase' }}>
          LimpAr · Coleta mensal
        </div>
        <h1 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 900, margin: '6px 0 0' }}>
          Fluxo de Carros por Loja
        </h1>
        <p style={{ color: T.sub, fontSize: 13, marginTop: 6, maxWidth: 620 }}>
          Anote quantos veículos passaram em cada loja no mês. Esse número vira o denominador do
          <strong style={{ color: T.txt }}> % de aproveitamento</strong> no benchmark.
        </p>
      </header>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={mes} onChange={e => setMes(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.line}`, background: T.panel, color: T.txt, fontWeight: 700, fontSize: 14 }}>
          {meses.map(m => <option key={m} value={m}>{mesLabel(m)}</option>)}
        </select>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar loja ou bairro…"
          style={{ flex: '1 1 220px', padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.line}`, background: T.panel, color: T.txt, fontSize: 14 }} />
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          ['Lojas preenchidas', `${preenchidas} / ${lojas.length}`],
          ['Total de carros', totalCarros.toLocaleString('pt-BR')],
          ['Alterações não salvas', alterados.length],
        ].map(([l, v]) => (
          <div key={l} style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.sub, fontWeight: 600 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
          background: (msg.tipo === 'ok' ? T.up : T.down) + '22', color: msg.tipo === 'ok' ? T.up : T.down }}>
          {msg.txt}
        </div>
      )}

      {/* Lista de lojas */}
      <div style={{ display: 'grid', gap: 8 }}>
        {lojasFiltradas.map(l => {
          const val = fluxo[l.id] ?? ''
          const mudou = (val || '') !== (original[l.id] || '')
          return (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10, background: T.panel2,
              border: `1px solid ${mudou ? T.amber + '66' : T.line}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</div>
                <div style={{ fontSize: 11, color: T.sub }}>
                  {l.bairro || '—'}{l.situacao && l.situacao !== 'Ativo' ? ` · ${l.situacao}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min="0" inputMode="numeric" placeholder="0"
                  value={val}
                  onChange={e => setFluxo({ ...fluxo, [l.id]: e.target.value })}
                  style={{ width: 90, padding: '8px 10px', borderRadius: 8, textAlign: 'right', fontWeight: 700, fontSize: 15,
                    border: `1px solid ${mudou ? T.amber : T.line}`, background: T.bg, color: T.txt }}
                />
                <span style={{ fontSize: 11, color: T.sub, width: 38 }}>carros</span>
              </div>
            </div>
          )
        })}
        {!lojasFiltradas.length && (
          <div style={{ color: T.sub, textAlign: 'center', padding: 30 }}>Nenhuma loja encontrada.</div>
        )}
      </div>

      {/* Barra de salvar (fixa) */}
      {alterados.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px clamp(12px, 3vw, 40px)',
          background: 'rgba(11,13,16,0.94)', borderTop: `1px solid ${T.line}`, backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: T.sub }}>
            <strong style={{ color: T.amber }}>{alterados.length}</strong> loja(s) com alteração em {mesLabel(mes)}
          </div>
          <button onClick={salvar} disabled={salvando}
            style={{ padding: '12px 28px', borderRadius: 10, border: 'none', cursor: salvando ? 'wait' : 'pointer',
              background: T.amber, color: '#141414', fontWeight: 800, fontSize: 14 }}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

/* CADASTRO DE LOJAS — /admin/lojas
   Editar nome fantasia, razão social, CNPJ, bairro e vendedor */

const T = { bg:'#0B0D10', panel:'#14171C', panel2:'#181C22', line:'#242932',
  txt:'#E8EAED', sub:'#8B95A5', amber:'#FFB000', up:'#3DDC84', down:'#FF6B6B' }

const soDigitos = s => String(s||'').replace(/\D/g,'')
const fmtCnpj = s => {
  const d = soDigitos(s).slice(0,14)
  if (d.length !== 14) return s || ''
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

export default function AdminLojas() {
  const [lojas, setLojas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [filtroVendedor, setFiltroVendedor] = useState(1)  // Rodrigo
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)   // id da loja aberta
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  async function carregar() {
    const [lc, vd] = await Promise.all([
      supabase.from('carteira_clientes')
        .select('id, nome, nome_fantasia, razao_social, cnpj, bairro, zona, situacao, ativo, vendedor_id')
        .order('nome'),
      supabase.from('carteira_vendedores').select('id, nome').order('id'),
    ])
    setLojas(lc.data || [])
    setVendedores(vd.data || [])
    setLoading(false)
  }
  useEffect(() => { carregar() }, [])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lojas
      .filter(l => filtroVendedor === 0 || l.vendedor_id === filtroVendedor)
      .filter(l => !q || [l.nome, l.nome_fantasia, l.razao_social, l.bairro, l.cnpj]
        .some(v => String(v||'').toLowerCase().includes(q)))
  }, [lojas, filtroVendedor, busca])

  function abrir(l) {
    setEditando(l.id)
    setForm({
      nome: l.nome || '',
      nome_fantasia: l.nome_fantasia || l.nome || '',
      razao_social: l.razao_social || '',
      cnpj: l.cnpj || '',
      bairro: l.bairro || '',
      situacao: l.situacao || 'Ativo',
      vendedor_id: l.vendedor_id || 1,
      ativo: l.ativo !== false,
    })
    setMsg(null)
  }

  async function salvar(id) {
    setSalvando(true); setMsg(null)
    const cnpjD = soDigitos(form.cnpj)
    if (form.cnpj && cnpjD.length !== 14) {
      setMsg({ tipo:'erro', txt:'CNPJ precisa ter 14 dígitos (ou deixe em branco).' })
      setSalvando(false); return
    }
    // impede CNPJ duplicado em outra loja
    if (cnpjD) {
      const dup = lojas.find(l => l.id !== id && soDigitos(l.cnpj) === cnpjD)
      if (dup) {
        setMsg({ tipo:'erro', txt:`Esse CNPJ já está em "${dup.nome}". Corrija um dos dois.` })
        setSalvando(false); return
      }
    }
    const { error } = await supabase.from('carteira_clientes').update({
      nome: form.nome_fantasia || form.nome,
      nome_fantasia: form.nome_fantasia || null,
      razao_social: form.razao_social || null,
      cnpj: cnpjD ? fmtCnpj(cnpjD) : null,
      bairro: form.bairro || null,
      situacao: form.situacao,
      vendedor_id: Number(form.vendedor_id),
      ativo: !!form.ativo,
    }).eq('id', id)
    if (error) setMsg({ tipo:'erro', txt:'Erro: ' + error.message })
    else { setMsg({ tipo:'ok', txt:'Loja atualizada.' }); setEditando(null); await carregar() }
    setSalvando(false)
  }

  const inp = { width:'100%', padding:'9px 11px', borderRadius:8, border:`1px solid ${T.line}`,
    background:T.bg, color:T.txt, fontSize:13.5, marginTop:4 }
  const lbl = { fontSize:10.5, textTransform:'uppercase', letterSpacing:'0.06em', color:T.sub, fontWeight:600 }

  if (loading) return <div style={{ minHeight:'100vh', background:T.bg, color:T.sub, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui' }}>Carregando lojas…</div>

  return (
    <div style={{ minHeight:'100vh', background:T.bg, color:T.txt, fontFamily:'system-ui, sans-serif', padding:'24px clamp(12px,3vw,40px) 60px' }}>
      <header style={{ marginBottom:20 }}>
        <a href="/admin" style={{ fontSize:12, color:T.sub, textDecoration:'none' }}>← Voltar ao painel</a>
        <div style={{ fontSize:11, letterSpacing:'0.14em', color:T.amber, fontWeight:700, textTransform:'uppercase', marginTop:12 }}>LimpAr · Carteira</div>
        <h1 style={{ fontSize:'clamp(22px,4vw,30px)', fontWeight:900, margin:'6px 0 0' }}>Cadastro de Lojas</h1>
        <p style={{ color:T.sub, fontSize:13, marginTop:6, maxWidth:640 }}>
          O <strong style={{color:T.txt}}>nome fantasia</strong> é o que aparece nos relatórios e no benchmark.
          A <strong style={{color:T.txt}}>razão social</strong> fica guardada para consulta.
        </p>
      </header>

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <select value={filtroVendedor} onChange={e => setFiltroVendedor(Number(e.target.value))}
          style={{ padding:'10px 14px', borderRadius:10, border:`1px solid ${T.amber}66`, background:T.panel, color:T.txt, fontWeight:700, fontSize:14 }}>
          {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          <option value={0}>— Todos os vendedores —</option>
        </select>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, CNPJ, bairro…"
          style={{ flex:'1 1 220px', padding:'10px 14px', borderRadius:10, border:`1px solid ${T.line}`, background:T.panel, color:T.txt, fontSize:14 }} />
      </div>

      <div style={{ fontSize:12, color:T.sub, marginBottom:12 }}>{filtradas.length} loja(s)</div>

      {msg && !editando && (
        <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:13, fontWeight:600,
          background:(msg.tipo==='ok'?T.up:T.down)+'22', color: msg.tipo==='ok'?T.up:T.down }}>{msg.txt}</div>
      )}

      <div style={{ display:'grid', gap:8 }}>
        {filtradas.map(l => {
          const aberto = editando === l.id
          return (
            <div key={l.id} style={{ background:T.panel2, border:`1px solid ${aberto ? T.amber+'66' : T.line}`, borderRadius:12, overflow:'hidden' }}>
              <div onClick={() => aberto ? setEditando(null) : abrir(l)}
                style={{ display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:12, padding:'12px 14px', cursor:'pointer' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.nome}</div>
                  <div style={{ fontSize:11, color:T.sub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {l.cnpj || 'sem CNPJ'}{l.bairro ? ' · ' + l.bairro : ''}
                    {l.razao_social && l.razao_social !== l.nome ? ' · RS: ' + l.razao_social : ''}
                  </div>
                </div>
                {l.situacao && l.situacao !== 'Ativo' && (
                  <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', padding:'3px 8px', borderRadius:999, background:T.sub+'22', color:T.sub }}>{l.situacao}</span>
                )}
                <span style={{ fontSize:11, color:T.amber, fontWeight:700 }}>{aberto ? 'fechar' : 'editar'}</span>
              </div>

              {aberto && (
                <div style={{ padding:'0 14px 14px', borderTop:`1px solid ${T.line}` }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px,1fr))', gap:12, marginTop:12 }}>
                    <label><span style={lbl}>Nome fantasia</span>
                      <input style={inp} value={form.nome_fantasia} onChange={e => setForm({...form, nome_fantasia:e.target.value})} /></label>
                    <label><span style={lbl}>Razão social</span>
                      <input style={inp} value={form.razao_social} onChange={e => setForm({...form, razao_social:e.target.value})} /></label>
                    <label><span style={lbl}>CNPJ</span>
                      <input style={inp} value={form.cnpj} onChange={e => setForm({...form, cnpj:e.target.value})} placeholder="00.000.000/0000-00" /></label>
                    <label><span style={lbl}>Bairro</span>
                      <input style={inp} value={form.bairro} onChange={e => setForm({...form, bairro:e.target.value})} /></label>
                    <label><span style={lbl}>Vendedor</span>
                      <select style={inp} value={form.vendedor_id} onChange={e => setForm({...form, vendedor_id:e.target.value})}>
                        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                      </select></label>
                    <label><span style={lbl}>Situação</span>
                      <select style={inp} value={form.situacao} onChange={e => setForm({...form, situacao:e.target.value})}>
                        {['Ativo','Inativo','Prospect','Suspenso'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select></label>
                  </div>

                  {msg && (
                    <div style={{ padding:'8px 12px', borderRadius:8, marginTop:12, fontSize:12.5, fontWeight:600,
                      background:(msg.tipo==='ok'?T.up:T.down)+'22', color: msg.tipo==='ok'?T.up:T.down }}>{msg.txt}</div>
                  )}

                  <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                    <button onClick={() => salvar(l.id)} disabled={salvando}
                      style={{ padding:'10px 22px', borderRadius:9, border:'none', cursor:salvando?'wait':'pointer',
                        background:T.amber, color:'#141414', fontWeight:800, fontSize:13 }}>
                      {salvando ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button onClick={() => { setEditando(null); setMsg(null) }}
                      style={{ padding:'10px 18px', borderRadius:9, border:`1px solid ${T.line}`, cursor:'pointer',
                        background:'transparent', color:T.sub, fontWeight:700, fontSize:13 }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!filtradas.length && <div style={{ color:T.sub, textAlign:'center', padding:30 }}>Nenhuma loja encontrada.</div>}
      </div>
    </div>
  )
}

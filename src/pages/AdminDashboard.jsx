import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const ADMIN_PASSWORD = 'limpar2026' // troque essa senha pelo que você quiser

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function AdminDashboard() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('limpar_admin_unlocked') === '1')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)
  const [linhas, setLinhas] = useState([])

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
      const resultados = await Promise.all((clientes || []).map(async (c) => {
        const { data: vendas } = await supabase.from('vendas').select('valor, status').eq('cliente_id', c.id)
        const validas = (vendas || []).filter(v => v.status !== 'Cancelado')
        const faturamento = validas.reduce((s, v) => s + Number(v.valor || 0), 0)
        return { id: c.id, nome: c.nome, slug: c.slug, qtdVendas: validas.length, faturamento }
      }))
      resultados.sort((a, b) => b.faturamento - a.faturamento)
      setLinhas(resultados)
      setLoading(false)
    })()
  }, [unlocked])

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
          <input
            type="password"
            placeholder="Senha"
            value={senha}
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

  const totalGeral = linhas.reduce((s, l) => s + l.faturamento, 0)
  const totalVendas = linhas.reduce((s, l) => s + l.qtdVendas, 0)

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard Geral — Todos os Clientes</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/" className="btn">← Voltar</a>
          <button className="btn" onClick={sair}>Sair</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Faturamento Total</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>R$ {fmt(totalGeral)}</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Total de Vendas</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalVendas}</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Clientes Ativos</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{linhas.length}</div>
        </div>
      </div>

      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>#</th><th>Cliente</th><th>Vendas</th><th>Faturamento</th></tr></thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Nenhum cliente cadastrado ainda.</td></tr>
              ) : linhas.map((l, i) => (
                <tr key={l.id}>
                  <td><b>{i + 1}º</b></td>
                  <td>{l.nome}</td>
                  <td>{l.qtdVendas}</td>
                  <td><b>R$ {fmt(l.faturamento)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCliente } from '../ClienteContext'

function slugify(text) {
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function SeletorCliente() {
  const { clientes, setClientes, selecionarCliente } = useCliente()
  const [novoNome, setNovoNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const criarCliente = async () => {
    if (!novoNome.trim()) { setErro('Digite o nome do cliente.'); return }
    setSaving(true)
    setErro('')
    const slug = slugify(novoNome)
    const { data, error } = await supabase.from('clientes').insert({ nome: novoNome.trim(), slug }).select().single()
    setSaving(false)
    if (error) {
      setErro(error.code === '23505' ? 'Já existe um cliente com nome parecido.' : 'Erro ao criar cliente.')
      return
    }
    setClientes(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    setNovoNome('')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-100)', padding: '1rem' }}>
      <div className="card" style={{ width: 420, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/logo.jpeg" alt="LimpAr Auto" style={{ maxWidth: 200, marginBottom: 12 }} />
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Selecione o cliente para continuar</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem', maxHeight: 280, overflowY: 'auto' }}>
          {clientes.length === 0 && (
            <p style={{ color: 'var(--gray-400)', textAlign: 'center', fontSize: 13 }}>Nenhum cliente cadastrado ainda.</p>
          )}
          {clientes.map(c => (
            <button
              key={c.id}
              className="btn"
              style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: 14 }}
              onClick={() => selecionarCliente(c)}
            >
              <i className="fas fa-building" style={{ color: 'var(--accent)' }}></i> {c.nome}
            </button>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '1rem' }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Novo cliente</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Nome do cliente"
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              style={{ flex: 1, padding: '9px 11px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)' }}
              onKeyDown={e => e.key === 'Enter' && criarCliente()}
            />
            <button className="btn btn-primary" onClick={criarCliente} disabled={saving}>
              <i className="fas fa-plus"></i>
            </button>
          </div>
          {erro && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{erro}</div>}
        </div>
        <div style={{ marginTop: 16 }}>
          <a
            href="/admin/visitas"
            style={{
              display: 'block', textAlign: 'center', padding: '12px',
              background: 'linear-gradient(135deg, #0f1f33, #1e3a5f)',
              color: '#FFB000', borderRadius: 10, fontWeight: 700,
              fontSize: 14, textDecoration: 'none', letterSpacing: 0.5,
              marginBottom: 10, border: '1px solid #FFB000'
            }}
          >
            <i className="fas fa-map-marked-alt" style={{ marginRight: 8 }}></i>
            ROTEIRO DE VISITAS
          </a>
          <div style={{ textAlign: 'center' }}>
            <a href="/admin" style={{ fontSize: 12, color: 'var(--gray-400)', textDecoration: 'none' }}>
              <i className="fas fa-chart-line"></i> Dashboard Geral
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

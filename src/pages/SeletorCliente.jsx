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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem', maxHeight: 280,

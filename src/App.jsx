import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { useCliente } from './ClienteContext'
import SeletorCliente from './pages/SeletorCliente'
import AdminDashboard from './pages/AdminDashboard'
import AdminVisitas from './pages/AdminVisitas'
import AdminBenchmark from './pages/AdminBenchmark'
import AdminFluxo from './pages/AdminFluxo'
import AdminLojas from './pages/AdminLojas'
import AdminFaturamento from './pages/AdminFaturamento'
import FaturamentoClientes from './pages/FaturamentoClientes'
import Dashboard from './pages/Dashboard'
import Vendas from './pages/Vendas'
import Vendedores from './pages/Vendedores'
import Servicos from './pages/Servicos'
import Comissoes from './pages/Comissoes'
import Ranking from './pages/Ranking'
import Relatorios from './pages/Relatorios'
import VendaModal from './components/VendaModal'
import Toast from './components/Toast'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
  { id: 'vendas', label: 'Controle de TMO/Venda', icon: 'fa-file-invoice-dollar' },
  { id: 'vendedores', label: 'Vendedores', icon: 'fa-users' },
  { id: 'servicos', label: 'Serviços', icon: 'fa-tools' },
  { id: 'comissoes', label: 'Comissões', icon: 'fa-money-bill-wave' },
  { id: 'ranking', label: 'Ranking Vendedores', icon: 'fa-trophy' },
  { id: 'relatorios', label: 'Relatórios', icon: 'fa-file-chart-column' },
  { id: 'faturamento', label: 'Faturamento & Bonificação', icon: 'fa-file-invoice-dollar' },
  { id: 'faturamento-clientes', label: 'Faturamento por Cliente', icon: 'fa-file-export' },
]

export default function App() {
  const { cliente, loading: clienteLoading, sairDoCliente } = useCliente()
  const [panel, setPanel] = useState('dashboard')
  const [vendas, setVendas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [servicos, setServicos] = useState([])
  const [comissoes, setComissoes] = useState([])
  const [fechamentos, setFechamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])
  const [vendaModalOpen, setVendaModalOpen] = useState(false)
  const [editingVenda, setEditingVenda] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const notify = useCallback((msg, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const loadAll = useCallback(async () => {
    if (!cliente) return
    const cid = cliente.id
    const [v, vd, s, c, f] = await Promise.all([
      supabase.from('vendas').select('*').eq('cliente_id', cid).order('os_num', { ascending: false }),
      supabase.from('vendedores').select('*').eq('cliente_id', cid).order('nome'),
      supabase.from('servicos').select('*').eq('cliente_id', cid).order('cod'),
      supabase.from('comissoes').select('*').eq('cliente_id', cid),
      supabase.from('fechamentos_comissao').select('*').eq('cliente_id', cid).order('mes', { ascending: false }),
    ])
    if (v.data) setVendas(v.data)
    if (vd.data) setVendedores(vd.data)
    if (s.data) setServicos(s.data)
    if (c.data) setComissoes(c.data)
    if (f.data) setFechamentos(f.data)
    setLoading(false)
  }, [cliente])

  useEffect(() => {
    if (!cliente) return
    setLoading(true)
    loadAll()
    const interval = setInterval(loadAll, 10000)
    return () => clearInterval(interval)
  }, [cliente, loadAll])

  const path = window.location.pathname.replace('/', '').trim()
  if (path === 'admin') {
    return <AdminDashboard />
  }
  if (path === 'admin/visitas') {
  return <AdminVisitas />
}
  if (path === 'admin/benchmark') {
    return <AdminBenchmark />
  }
  if (path === 'admin/fluxo') {
    return <AdminFluxo />
  }
  if (path === 'admin/lojas') {
    return <AdminLojas />
  }

  if (clienteLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Carregando...</div>
  }

  if (!cliente) {
    return <SeletorCliente />
  }

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Carregando dados de {cliente.nome}...</div>
  }

  const pageTitle = NAV.find(n => n.id === panel)?.label || ''

  return (
    <div className="app-shell">
      <Toast toasts={toasts} />
      {mobileMenuOpen && <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)}></div>}
      <nav className={'sidebar' + (mobileMenuOpen ? ' sidebar-open' : '')}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon" style={{ background: 'white', padding: 4 }}>
            <img src="/logo.jpeg" alt="LimpAr Auto" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>LimpAr Auto</div>
            <div style={{ fontSize: 11, color: '#93c5fd' }}>{cliente.nome}</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map(n => (
            <div key={n.id} className={'nav-item' + (panel === n.id ? ' active' : '')} onClick={() => { setPanel(n.id); setMobileMenuOpen(false) }}>
              <i className={'fas ' + n.icon}></i> {n.label}
            </div>
          ))}
        </div>
        <div className="nav-item" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '8px' }} onClick={sairDoCliente}>
          <i className="fas fa-right-from-bracket"></i> Trocar cliente
        </div>
      </nav>
      <main className="main">
        <div className="mobile-topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menu">
            <i className="fas fa-bars"></i>
          </button>
          <div className="mobile-topbar-title">{pageTitle}</div>
        </div>
        <h1 className="desktop-title" style={{ fontSize: 18, fontWeight: 700, marginBottom: '1rem' }}>{pageTitle}</h1>

        {panel === 'dashboard' && (
          <Dashboard
            vendas={vendas} vendedores={vendedores} comissoes={comissoes}
            onNovaVenda={() => { setEditingVenda(null); setVendaModalOpen(true) }}
          />
        )}
        {panel === 'vendas' && (
          <Vendas
            vendas={vendas} vendedores={vendedores}
            onNovaVenda={() => { setEditingVenda(null); setVendaModalOpen(true) }}
            onEditVenda={(v) => { setEditingVenda(v); setVendaModalOpen(true) }}
            onDeleted={loadAll} notify={notify}
          />
        )}
        {panel === 'vendedores' && <Vendedores vendedores={vendedores} onChanged={loadAll} notify={notify} clienteId={cliente.id} />}
        {panel === 'servicos' && <Servicos servicos={servicos} onChanged={loadAll} notify={notify} clienteId={cliente.id} />}
        {panel === 'comissoes' && (
          <Comissoes
            comissoes={comissoes} vendedores={vendedores} vendas={vendas} fechamentos={fechamentos}
            onChanged={loadAll} notify={notify} clienteId={cliente.id}
            {panel === 'faturamento' && <AdminFaturamento />}
        {panel === 'faturamento-clientes' && <FaturamentoClientes />}
          />
        )}
        {panel === 'ranking' && <Ranking vendas={vendas} vendedores={vendedores} />}
        {panel === 'relatorios' && <Relatorios vendas={vendas} vendedores={vendedores} servicos={servicos} notify={notify} clienteNome={cliente.nome} />}
      </main>

      {vendaModalOpen && (
        <VendaModal
          vendedores={vendedores} servicos={servicos}
          vendas={vendas} comissoes={comissoes}
          editing={editingVenda}
          onClose={() => setVendaModalOpen(false)}
          onSaved={() => { setVendaModalOpen(false); loadAll() }}
          notify={notify}
          clienteId={cliente.id}
        />
      )}
    </div>
  )
}

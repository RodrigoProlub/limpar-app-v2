import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Dashboard from './pages/Dashboard'
import Vendas from './pages/Vendas'
import Vendedores from './pages/Vendedores'
import Servicos from './pages/Servicos'
import Veiculos from './pages/Veiculos'
import Comissoes from './pages/Comissoes'
import Ranking from './pages/Ranking'
import Relatorios from './pages/Relatorios'
import VendaModal from './components/VendaModal'
import Toast from './components/Toast'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
  { id: 'vendas', label: 'Controle de Vendas', icon: 'fa-file-invoice-dollar' },
  { id: 'vendedores', label: 'Vendedores', icon: 'fa-users' },
  { id: 'servicos', label: 'Serviços', icon: 'fa-tools' },
  { id: 'veiculos', label: 'Veículos', icon: 'fa-car' },
  { id: 'comissoes', label: 'Comissões', icon: 'fa-money-bill-wave' },
  { id: 'ranking', label: 'Ranking Vendedores', icon: 'fa-trophy' },
  { id: 'relatorios', label: 'Relatórios', icon: 'fa-file-chart-column' },
]

export default function App() {
  const [panel, setPanel] = useState('dashboard')
  const [vendas, setVendas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [servicos, setServicos] = useState([])
  const [veiculos, setVeiculos] = useState([])
  const [comissoes, setComissoes] = useState([])
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
    const [v, vd, s, vc, c] = await Promise.all([
      supabase.from('vendas').select('*').order('os_num', { ascending: false }),
      supabase.from('vendedores').select('*').order('nome'),
      supabase.from('servicos').select('*').order('cod'),
      supabase.from('veiculos').select('*').order('placa'),
      supabase.from('comissoes').select('*'),
    ])
    if (v.data) setVendas(v.data)
    if (vd.data) setVendedores(vd.data)
    if (s.data) setServicos(s.data)
    if (vc.data) setVeiculos(vc.data)
    if (c.data) setComissoes(c.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 10000) // auto-refresh every 10s
    return () => clearInterval(interval)
  }, [loadAll])

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Carregando dados...</div>
  }

  const pageTitle = NAV.find(n => n.id === panel)?.label || ''

  return (
    <div className="app-shell">
      <Toast toasts={toasts} />
      {mobileMenuOpen && <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)}></div>}
      <nav className={'sidebar' + (mobileMenuOpen ? ' sidebar-open' : '')}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><i className="fas fa-broom" style={{ color: 'white' }}></i></div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>LimpAr</div>
            <div style={{ fontSize: 11, color: '#93c5fd' }}>Gestão Comercial</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map(n => (
            <div key={n.id} className={'nav-item' + (panel === n.id ? ' active' : '')} onClick={() => { setPanel(n.id); setMobileMenuOpen(false) }}>
              <i className={'fas ' + n.icon}></i> {n.label}
            </div>
          ))}
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
        {panel === 'vendedores' && <Vendedores vendedores={vendedores} onChanged={loadAll} notify={notify} />}
        {panel === 'servicos' && <Servicos servicos={servicos} onChanged={loadAll} notify={notify} />}
        {panel === 'veiculos' && <Veiculos veiculos={veiculos} onChanged={loadAll} notify={notify} />}
        {panel === 'comissoes' && <Comissoes comissoes={comissoes} vendedores={vendedores} onChanged={loadAll} notify={notify} />}
        {panel === 'ranking' && <Ranking vendas={vendas} vendedores={vendedores} />}
        {panel === 'relatorios' && <Relatorios vendas={vendas} vendedores={vendedores} servicos={servicos} notify={notify} />}
      </main>

      {vendaModalOpen && (
        <VendaModal
          vendedores={vendedores} servicos={servicos} veiculos={veiculos}
          editing={editingVenda}
          onClose={() => setVendaModalOpen(false)}
          onSaved={() => { setVendaModalOpen(false); loadAll() }}
          notify={notify}
        />
      )}
    </div>
  )
}

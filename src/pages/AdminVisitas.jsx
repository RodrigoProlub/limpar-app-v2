import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

// ---- Configuracao ----
const SENHA_ADMIN = 'limpar2026' // mesma senha do /admin - troque aqui se quiser uma diferente
const DIAS = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA']
const DIA_COR = {
  SEGUNDA: '#2F5496',
  TERÇA: '#548235',
  QUARTA: '#BF8F00',
  QUINTA: '#C00000',
  SEXTA: '#7030A0',
}

const RODIZIO_COR = {
  Fora: { bg: '#E2F0D9', fg: '#2E7D32' },
  Dentro: { bg: '#FCE4E4', fg: '#C62828' },
  Confirmar: { bg: '#FFF2CC', fg: '#B7791F' },
}

const STATUS_COR = {
  Visitado: { bg: '#E2F0D9', fg: '#2E7D32' },
  Pendente: { bg: '#FFF2CC', fg: '#B7791F' },
  Reagendado: { bg: '#FFE6CC', fg: '#C0610C' },
  Cancelado: { bg: '#FCE4E4', fg: '#C62828' },
}

function Badge({ texto, cores }) {
  const c = cores[texto] || { bg: '#eee', fg: '#555' }
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {texto}
    </span>
  )
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Botao({ children, onClick, variant = 'primary', disabled, type, style }) {
  const base = {
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
  const variants = {
    primary: { background: 'var(--accent, #29abe2)', color: '#fff' },
    secondary: { background: '#eef1f5', color: '#1a2744' },
    danger: { background: '#dc2626', color: '#fff' },
  }
  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  )
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '9px 12px',
        borderRadius: 8,
        border: '1px solid #d8dde3',
        fontSize: 14,
        boxSizing: 'border-box',
        ...(props.style || {}),
      }}
    />
  )
}

export default function AdminVisitas() {
  const [autenticado, setAutenticado] = useState(false)
  const [senhaDigitada, setSenhaDigitada] = useState('')
  const [erroSenha, setErroSenha] = useState('')

  const [aba, setAba] = useState('roteiro') // roteiro | clientes | historico | painel
  const [clientes, setClientes] = useState([])
  const [visitas, setVisitas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [novoCliente, setNovoCliente] = useState({
    nome: '', cnpj: '', cep: '', endereco: '', bairro: '',
  })
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  const [modalVisita, setModalVisita] = useState(null) // { clienteId, nome } | null
  const [formVisita, setFormVisita] = useState({ status: 'Visitado', data: '', observacao: '' })
  const [salvandoVisita, setSalvandoVisita] = useState(false)

  const [filtroMes, setFiltroMes] = useState('')

  useEffect(() => {
    if (autenticado) {
      carregarTudo()
    }
  }, [autenticado])

  async function carregarTudo() {
    setCarregando(true)
    setErro('')
    try {
      const [{ data: cli, error: e1 }, { data: vis, error: e2 }] = await Promise.all([
        supabase.from('carteira_clientes').select('*').order('nome'),
        supabase.from('carteira_visitas').select('*').order('data_visita', { ascending: false }),
      ])
      if (e1) throw e1
      if (e2) throw e2
      setClientes(cli || [])
      setVisitas(vis || [])
    } catch (err) {
      setErro('Erro ao carregar dados: ' + err.message)
    } finally {
      setCarregando(false)
    }
  }

  function entrar() {
    if (senhaDigitada === SENHA_ADMIN) {
      setAutenticado(true)
      setErroSenha('')
    } else {
      setErroSenha('Senha incorreta')
    }
  }

  // ultima visita registrada por cliente (a mais recente por data, depois por criado_em)
  const ultimaVisitaPorCliente = useMemo(() => {
    const map = {}
    for (const v of visitas) {
      const atual = map[v.cliente_id]
      if (!atual) {
        map[v.cliente_id] = v
      } else {
        const dAtual = atual.data_visita + 'T' + (atual.criado_em || '')
        const dNova = v.data_visita + 'T' + (v.criado_em || '')
        if (dNova > dAtual) map[v.cliente_id] = v
      }
    }
    return map
  }, [visitas])

  function statusDoCliente(clienteId) {
    return ultimaVisitaPorCliente[clienteId]?.status || 'Pendente'
  }

  async function salvarNovoCliente(e) {
    e.preventDefault()
    if (!novoCliente.nome || !novoCliente.cep) {
      setErro('Preencha pelo menos Nome e CEP.')
      return
    }
    setSalvandoCliente(true)
    setErro('')
    try {
      const { error } = await supabase.from('carteira_clientes').insert([novoCliente])
      if (error) throw error
      setNovoCliente({ nome: '', cnpj: '', cep: '', endereco: '', bairro: '' })
      await carregarTudo()
    } catch (err) {
      setErro('Erro ao salvar cliente: ' + err.message)
    } finally {
      setSalvandoCliente(false)
    }
  }

  function abrirModalVisita(cliente) {
    setModalVisita({ clienteId: cliente.id, nome: cliente.nome })
    setFormVisita({
      status: 'Visitado',
      data: new Date().toISOString().slice(0, 10),
      observacao: '',
    })
  }

  async function salvarVisita(e) {
    e.preventDefault()
    if (!modalVisita) return
    setSalvandoVisita(true)
    setErro('')
    try {
      const { error } = await supabase.from('carteira_visitas').insert([{
        cliente_id: modalVisita.clienteId,
        data_visita: formVisita.data,
        status: formVisita.status,
        observacao: formVisita.observacao,
      }])
      if (error) throw error
      setModalVisita(null)
      await carregarTudo()
    } catch (err) {
      setErro('Erro ao registrar visita: ' + err.message)
    } finally {
      setSalvandoVisita(false)
    }
  }

  const clientesPorDia = useMemo(() => {
    const map = {}
    for (const d of DIAS) map[d] = []
    const outros = []
    for (const c of clientes) {
      if (DIAS.includes(c.dia_sugerido)) map[c.dia_sugerido].push(c)
      else outros.push(c)
    }
    return { map, outros }
  }, [clientes])

  const painelPorDia = useMemo(() => {
    return DIAS.map((d) => {
      const lista = clientesPorDia.map[d]
      const total = lista.length
      const visitados = lista.filter((c) => statusDoCliente(c.id) === 'Visitado').length
      const pendentes = lista.filter((c) => statusDoCliente(c.id) === 'Pendente').length
      const reagendados = lista.filter((c) => statusDoCliente(c.id) === 'Reagendado').length
      return { dia: d, total, visitados, pendentes, reagendados }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientesPorDia, ultimaVisitaPorCliente])

  const visitasFiltradas = useMemo(() => {
    if (!filtroMes) return visitas
    return visitas.filter((v) => (v.data_visita || '').startsWith(filtroMes))
  }, [visitas, filtroMes])

  function nomeCliente(id) {
    return clientes.find((c) => c.id === id)?.nome || '(cliente removido)'
  }

  // ---------------- TELA DE SENHA ----------------
  if (!autenticado) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--primary, #0f1f33)', fontFamily: 'system-ui, sans-serif',
      }}>
        <Card style={{ width: 320 }}>
          <h2 style={{ marginTop: 0, color: 'var(--primary, #0f1f33)' }}>Carteira de Visitas</h2>
          <p style={{ color: '#666', fontSize: 14 }}>Área restrita</p>
          <Input
            type="password"
            placeholder="Senha"
            value={senhaDigitada}
            onChange={(e) => setSenhaDigitada(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
          />
          {erroSenha && <p style={{ color: '#dc2626', fontSize: 13 }}>{erroSenha}</p>}
          <Botao onClick={entrar} style={{ width: '100%', marginTop: 12 }}>Entrar</Botao>
        </Card>
      </div>
    )
  }

  // ---------------- APP PRINCIPAL ----------------
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f4f6f8', minHeight: '100vh' }}>
      <div style={{ background: 'var(--primary, #0f1f33)', color: '#fff', padding: '18px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Carteira de Visitas — BASE SP</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.8 }}>LimpAr Auto Gestão Comercial</p>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '16px 24px 0' }}>
        {[
          ['roteiro', 'Roteiro Semanal'],
          ['clientes', 'Clientes'],
          ['historico', 'Histórico de Visitas'],
          ['painel', 'Painel'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            style={{
              border: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              background: aba === key ? '#fff' : 'transparent',
              color: aba === key ? 'var(--primary, #0f1f33)' : '#fff',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {erro && (
          <Card style={{ background: '#fee2e2', color: '#991b1b', marginBottom: 16 }}>{erro}</Card>
        )}
        {carregando && <p>Carregando...</p>}

        {/* ---------------- ABA ROTEIRO SEMANAL ---------------- */}
        {!carregando && aba === 'roteiro' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {DIAS.map((d) => (
              <Card key={d}>
                <div style={{
                  background: DIA_COR[d], color: '#fff', padding: '8px 12px',
                  borderRadius: 8, fontWeight: 700, marginBottom: 12, textAlign: 'center',
                }}>
                  {d} ({clientesPorDia.map[d].length})
                </div>
                {clientesPorDia.map[d].length === 0 && (
                  <p style={{ color: '#999', fontSize: 13 }}>Nenhum cliente neste dia.</p>
                )}
                {clientesPorDia.map[d].map((c) => (
                  <div key={c.id} style={{
                    padding: '10px 0', borderBottom: '1px solid #eee',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
                    <div style={{ fontSize: 12, color: '#777' }}>{c.bairro}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge texto={c.status_rodizio} cores={RODIZIO_COR} />
                      <Badge texto={statusDoCliente(c.id)} cores={STATUS_COR} />
                      <button
                        onClick={() => abrirModalVisita(c)}
                        style={{
                          marginLeft: 'auto', border: 'none', background: 'none',
                          color: 'var(--accent, #29abe2)', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', textDecoration: 'underline',
                        }}
                      >
                        marcar visita
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            ))}
            {clientesPorDia.outros.length > 0 && (
              <Card>
                <div style={{
                  background: '#999', color: '#fff', padding: '8px 12px',
                  borderRadius: 8, fontWeight: 700, marginBottom: 12, textAlign: 'center',
                }}>
                  A confirmar ({clientesPorDia.outros.length})
                </div>
                {clientesPorDia.outros.map((c) => (
                  <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
                    <div style={{ fontSize: 12, color: '#777' }}>{c.cep} — {c.bairro}</div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* ---------------- ABA CLIENTES ---------------- */}
        {!carregando && aba === 'clientes' && (
          <>
            <Card style={{ marginBottom: 20 }}>
              <h3 style={{ marginTop: 0 }}>Adicionar cliente</h3>
              <form onSubmit={salvarNovoCliente}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <Input placeholder="Nome *" value={novoCliente.nome}
                    onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })} />
                  <Input placeholder="CNPJ" value={novoCliente.cnpj}
                    onChange={(e) => setNovoCliente({ ...novoCliente, cnpj: e.target.value })} />
                  <Input placeholder="CEP * (ex: 05521-200)" value={novoCliente.cep}
                    onChange={(e) => setNovoCliente({ ...novoCliente, cep: e.target.value })} />
                  <Input placeholder="Endereço" value={novoCliente.endereco}
                    onChange={(e) => setNovoCliente({ ...novoCliente, endereco: e.target.value })} />
                  <Input placeholder="Bairro" value={novoCliente.bairro}
                    onChange={(e) => setNovoCliente({ ...novoCliente, bairro: e.target.value })} />
                </div>
                <Botao type="submit" disabled={salvandoCliente} style={{ marginTop: 12 }}>
                  {salvandoCliente ? 'Salvando...' : 'Salvar cliente'}
                </Botao>
              </form>
            </Card>

            <Card>
              <h3 style={{ marginTop: 0 }}>Todos os clientes ({clientes.length})</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                      <th style={{ padding: 8 }}>Nome</th>
                      <th style={{ padding: 8 }}>CEP</th>
                      <th style={{ padding: 8 }}>Bairro</th>
                      <th style={{ padding: 8 }}>Dia</th>
                      <th style={{ padding: 8 }}>Rodízio</th>
                      <th style={{ padding: 8 }}>Status</th>
                      <th style={{ padding: 8 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
                        <td style={{ padding: 8, fontWeight: 600 }}>{c.nome}</td>
                        <td style={{ padding: 8 }}>{c.cep}</td>
                        <td style={{ padding: 8 }}>{c.bairro}</td>
                        <td style={{ padding: 8 }}>{c.dia_sugerido}</td>
                        <td style={{ padding: 8 }}><Badge texto={c.status_rodizio} cores={RODIZIO_COR} /></td>
                        <td style={{ padding: 8 }}><Badge texto={statusDoCliente(c.id)} cores={STATUS_COR} /></td>
                        <td style={{ padding: 8 }}>
                          <button onClick={() => abrirModalVisita(c)} style={{
                            border: 'none', background: 'none', color: 'var(--accent, #29abe2)',
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}>marcar visita</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ---------------- ABA HISTORICO ---------------- */}
        {!carregando && aba === 'historico' && (
          <Card>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Histórico de Visitas</h3>
              <input
                type="month"
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d8dde3' }}
              />
              {filtroMes && (
                <button onClick={() => setFiltroMes('')} style={{
                  border: 'none', background: 'none', color: '#999', cursor: 'pointer', fontSize: 13,
                }}>limpar filtro</button>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: 8 }}>Data</th>
                  <th style={{ padding: 8 }}>Cliente</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Observação</th>
                </tr>
              </thead>
              <tbody>
                {visitasFiltradas.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
                    <td style={{ padding: 8 }}>{v.data_visita}</td>
                    <td style={{ padding: 8, fontWeight: 600 }}>{nomeCliente(v.cliente_id)}</td>
                    <td style={{ padding: 8 }}><Badge texto={v.status} cores={STATUS_COR} /></td>
                    <td style={{ padding: 8, color: '#555' }}>{v.observacao}</td>
                  </tr>
                ))}
                {visitasFiltradas.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#999' }}>
                    Nenhuma visita registrada {filtroMes ? 'neste mês' : 'ainda'}.
                  </td></tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        {/* ---------------- ABA PAINEL ---------------- */}
        {!carregando && aba === 'painel' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
              <Card style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary, #0f1f33)' }}>{clientes.length}</div>
                <div style={{ color: '#777', fontSize: 13 }}>Total de clientes</div>
              </Card>
              <Card style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#2E7D32' }}>
                  {clientes.filter((c) => statusDoCliente(c.id) === 'Visitado').length}
                </div>
                <div style={{ color: '#777', fontSize: 13 }}>Visitados</div>
              </Card>
              <Card style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#B7791F' }}>
                  {clientes.filter((c) => statusDoCliente(c.id) === 'Pendente').length}
                </div>
                <div style={{ color: '#777', fontSize: 13 }}>Pendentes</div>
              </Card>
              <Card style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent, #29abe2)' }}>
                  {visitas.length}
                </div>
                <div style={{ color: '#777', fontSize: 13 }}>Visitas no histórico</div>
              </Card>
            </div>

            <Card>
              <h3 style={{ marginTop: 0 }}>Por dia da semana</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                    <th style={{ padding: 8 }}>Dia</th>
                    <th style={{ padding: 8 }}>Total</th>
                    <th style={{ padding: 8 }}>Visitados</th>
                    <th style={{ padding: 8 }}>Pendentes</th>
                    <th style={{ padding: 8 }}>Reagendados</th>
                    <th style={{ padding: 8 }}>% concluído</th>
                  </tr>
                </thead>
                <tbody>
                  {painelPorDia.map((p) => (
                    <tr key={p.dia} style={{ borderBottom: '1px solid #f2f2f2' }}>
                      <td style={{ padding: 8, fontWeight: 700, color: DIA_COR[p.dia] }}>{p.dia}</td>
                      <td style={{ padding: 8 }}>{p.total}</td>
                      <td style={{ padding: 8, color: '#2E7D32', fontWeight: 600 }}>{p.visitados}</td>
                      <td style={{ padding: 8, color: '#B7791F', fontWeight: 600 }}>{p.pendentes}</td>
                      <td style={{ padding: 8, color: '#C0610C', fontWeight: 600 }}>{p.reagendados}</td>
                      <td style={{ padding: 8 }}>
                        {p.total ? Math.round((p.visitados / p.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>

      {/* ---------------- MODAL MARCAR VISITA ---------------- */}
      {modalVisita && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <Card style={{ width: 360 }}>
            <h3 style={{ marginTop: 0 }}>Registrar visita</h3>
            <p style={{ color: '#666', fontSize: 14 }}>{modalVisita.nome}</p>
            <form onSubmit={salvarVisita}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Status</label>
              <select
                value={formVisita.status}
                onChange={(e) => setFormVisita({ ...formVisita, status: e.target.value })}
                style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #d8dde3', marginBottom: 10 }}
              >
                <option value="Visitado">Visitado</option>
                <option value="Reagendado">Reagendado</option>
                <option value="Cancelado">Cancelado</option>
              </select>

              <label style={{ fontSize: 13, fontWeight: 600 }}>Data</label>
              <Input
                type="date"
                value={formVisita.data}
                onChange={(e) => setFormVisita({ ...formVisita, data: e.target.value })}
                style={{ marginBottom: 10 }}
              />

              <label style={{ fontSize: 13, fontWeight: 600 }}>Observação</label>
              <textarea
                value={formVisita.observacao}
                onChange={(e) => setFormVisita({ ...formVisita, observacao: e.target.value })}
                rows={3}
                style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #d8dde3', marginBottom: 14, boxSizing: 'border-box' }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <Botao type="submit" disabled={salvandoVisita}>
                  {salvandoVisita ? 'Salvando...' : 'Salvar'}
                </Botao>
                <Botao variant="secondary" onClick={() => setModalVisita(null)}>Cancelar</Botao>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

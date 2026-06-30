import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

// =====================================================================
// SISTEMA DE DESIGN — "Painel de Despacho"
// Inspirado em mapas de roteiro/metrô: cada dia e uma linha, cada
// cliente e uma parada. Paleta grafite + papel + ambar de sinalizacao.
// =====================================================================

// A senha unica fixa deu lugar ao login por vendedor (tabela carteira_vendedores)

const COR = {
  ink: '#14181F',
  inkSoft: '#1E2430',
  paper: '#F6F4EF',
  paperRaised: '#FFFFFF',
  line: '#DEDACF',
  lineSoft: '#EAE7DD',
  amber: '#F2A93B',
  amberDeep: '#C97F0F',
  textPrimary: '#1B1F27',
  textSecondary: '#6B6458',
  textOnInk: '#F6F4EF',
  textOnInkSoft: '#9CA3AF',
}

const DIAS = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA']

const LINHA_DIA = {
  SEGUNDA: { cor: '#3E6E91', nome: 'Linha Segunda' },
  TERÇA: { cor: '#6B7F3F', nome: 'Linha Terça' },
  QUARTA: { cor: '#B6862F', nome: 'Linha Quarta' },
  QUINTA: { cor: '#8C3F4F', nome: 'Linha Quinta' },
  SEXTA: { cor: '#5B5285', nome: 'Linha Sexta' },
}

const RODIZIO_INFO = {
  Fora: { cor: '#3F6B4D', label: 'Fora do anel' },
  Dentro: { cor: '#8C3F4F', label: 'Dentro do anel' },
  Confirmar: { cor: '#B6862F', label: 'Confirmar' },
}

const STATUS_INFO = {
  Visitado: { cor: '#3F6B4D', label: 'Visitado' },
  Pendente: { cor: '#B6862F', label: 'Pendente' },
  Reagendado: { cor: '#A0622E', label: 'Reagendado' },
  Cancelado: { cor: '#8C3F4F', label: 'Cancelado' },
}

const SITUACAO_INFO = {
  Ativo: { cor: '#3F6B4D', label: 'Ativo' },
  'Prospecção': { cor: '#3E6E91', label: 'Prospecção' },
  Inativo: { cor: '#8A8377', label: 'Inativo' },
}
const SITUACOES = ['Ativo', 'Prospecção', 'Inativo']

function FontLoader() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      .av-root, .av-root * { font-family: 'Inter', system-ui, sans-serif; }
      .av-display { font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif; }
      .av-mono { font-family: 'IBM Plex Mono', monospace; }
      .av-root ::selection { background: ${COR.amber}; color: ${COR.ink}; }
      .av-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
      .av-scroll::-webkit-scrollbar-thumb { background: ${COR.line}; border-radius: 4px; }
    `}</style>
  )
}

function Dot({ cor, size = 9 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: cor, flexShrink: 0,
    }} />
  )
}

function Etiqueta({ texto, info }) {
  const i = info[texto] || { cor: COR.textSecondary, label: texto }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
      color: COR.textSecondary,
    }}>
      <Dot cor={i.cor} size={7} />
      {i.label}
    </span>
  )
}

function Painel({ children, style }) {
  return (
    <div style={{
      background: COR.paperRaised,
      border: `1px solid ${COR.line}`,
      borderRadius: 6,
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  )
}

function Botao({ children, onClick, variant = 'primary', disabled, type, style }) {
  const variants = {
    primary: { background: COR.ink, color: COR.textOnInk, border: `1px solid ${COR.ink}` },
    amber: { background: COR.amber, color: COR.ink, border: `1px solid ${COR.amber}` },
    ghost: { background: 'transparent', color: COR.textPrimary, border: `1px solid ${COR.line}` },
  }
  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 4,
        padding: '9px 16px',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s',
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function Campo({ label, ...props }) {
  return (
    <label style={{ display: 'block', fontSize: 12 }}>
      {label && (
        <span style={{
          display: 'block', marginBottom: 5, color: COR.textSecondary,
          fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10.5,
        }}>{label}</span>
      )}
      <input
        {...props}
        style={{
          width: '100%', padding: '9px 11px', borderRadius: 4,
          border: `1px solid ${COR.line}`, fontSize: 14, color: COR.textPrimary,
          background: COR.paper, fontFamily: 'Inter, sans-serif',
          ...(props.style || {}),
        }}
      />
    </label>
  )
}

const DIAS_OPCOES = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'Verificar manualmente']

function SeletorDia({ cliente, onChange }) {
  const cor = LINHA_DIA[cliente.dia_sugerido]?.cor || COR.textSecondary
  return (
    <select
      value={cliente.dia_sugerido || 'Verificar manualmente'}
      onChange={(e) => onChange(cliente.id, e.target.value)}
      style={{
        border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700,
        color: cor, cursor: 'pointer', padding: 0,
      }}
    >
      {DIAS_OPCOES.map((d) => <option key={d} value={d}>{d}</option>)}
    </select>
  )
}

function SeletorSituacao({ cliente, onChange }) {
  const info = SITUACAO_INFO[cliente.situacao] || SITUACAO_INFO.Ativo
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Dot cor={info.cor} size={7} />
      <select
        value={cliente.situacao || 'Ativo'}
        onChange={(e) => onChange(cliente.id, e.target.value)}
        style={{
          border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600,
          color: COR.textSecondary, cursor: 'pointer', padding: 0,
        }}
      >
        {SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </span>
  )
}

// =====================================================================
// GEOLOCALIZAÇÃO — ordenação por proximidade e mapa visual (Leaflet/OSM)
// =====================================================================

// Ponto de partida aproximado (Taboão da Serra). Usado só pra ordenar a
// rota do dia e montar o link do Google Maps — não precisa ser exato.
const CASA_BASE = { lat: -23.6229, lng: -46.7817 }

function distanciaKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Algoritmo do "vizinho mais próximo": sempre vai para o cliente mais perto
// de onde "está" no momento, começando de casa. Não é matematicamente
// perfeito (problema do caixeiro-viajante não tem solução simples), mas dá
// uma rota bem melhor que a ordem alfabética ou de cadastro.
function ordenarPorProximidade(clientesComCoord, origem) {
  const restantes = [...clientesComCoord]
  const ordenado = []
  let atual = origem
  while (restantes.length > 0) {
    let melhorIdx = 0
    let melhorDist = Infinity
    restantes.forEach((c, i) => {
      const d = distanciaKm(atual, { lat: c.latitude, lng: c.longitude })
      if (d < melhorDist) { melhorDist = d; melhorIdx = i }
    })
    const [proximo] = restantes.splice(melhorIdx, 1)
    ordenado.push(proximo)
    atual = { lat: proximo.latitude, lng: proximo.longitude }
  }
  return ordenado
}

function linkGoogleMaps(pontosOrdenados) {
  if (pontosOrdenados.length === 0) return null
  const origin = `${CASA_BASE.lat},${CASA_BASE.lng}`
  const ultimo = pontosOrdenados[pontosOrdenados.length - 1]
  const destination = `${ultimo.latitude},${ultimo.longitude}`
  const waypoints = pontosOrdenados.slice(0, -1).map((p) => `${p.latitude},${p.longitude}`).join('|')
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`
  return url
}

// Carrega o Leaflet (biblioteca de mapas open-source, gratuita) via CDN só
// quando algum mapa precisa ser exibido — não pesa o carregamento inicial.
function useLeaflet() {
  const [pronto, setPronto] = useState(typeof window !== 'undefined' && !!window.L)
  useEffect(() => {
    if (typeof window === 'undefined' || window.L) { setPronto(true); return }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if (document.getElementById('leaflet-js')) {
      const check = setInterval(() => {
        if (window.L) { setPronto(true); clearInterval(check) }
      }, 200)
      return () => clearInterval(check)
    }
    const script = document.createElement('script')
    script.id = 'leaflet-js'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setPronto(true)
    document.body.appendChild(script)
  }, [])
  return pronto
}

function MapaDia({ pontos, cor }) {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const leafletPronto = useLeaflet()

  useEffect(() => {
    if (!leafletPronto || !ref.current || pontos.length === 0) return
    try {
      if (!mapRef.current) {
        mapRef.current = window.L.map(ref.current)
      }
      const map = mapRef.current
      map.eachLayer((layer) => map.removeLayer(layer))
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const latlngs = pontos.map((p) => [p.latitude, p.longitude])
      pontos.forEach((p, i) => {
        window.L.marker([p.latitude, p.longitude])
          .addTo(map)
          .bindTooltip(`${i + 1}. ${p.nome}`)
      })
      if (latlngs.length > 1) {
        window.L.polyline(latlngs, { color: cor, weight: 3, opacity: 0.6 }).addTo(map)
      }
      map.fitBounds(latlngs, { padding: [28, 28] })
      setTimeout(() => map.invalidateSize(), 150)
    } catch {
      // se o mapa falhar por algum motivo, a tela continua funcionando normalmente
    }
  }, [leafletPronto, pontos, cor])

  if (pontos.length === 0) {
    return (
      <p style={{ color: COR.textSecondary, fontSize: 12.5, padding: '8px 0' }}>
        Nenhum cliente com localização cadastrada neste dia ainda.
      </p>
    )
  }

  return <div ref={ref} style={{ height: 230, borderRadius: 6, border: `1px solid ${COR.line}` }} />
}

export default function AdminVisitas() {
  const [vendedor, setVendedor] = useState(null) // { id, nome, usuario, admin } | null
  const [usuarioDigitado, setUsuarioDigitado] = useState('')
  const [senhaDigitada, setSenhaDigitada] = useState('')
  const [erroSenha, setErroSenha] = useState('')
  const [entrando, setEntrando] = useState(false)
  const autenticado = !!vendedor

  const [aba, setAba] = useState('roteiro')
  const [clientes, setClientes] = useState([])
  const [visitas, setVisitas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [novoCliente, setNovoCliente] = useState({ nome: '', cnpj: '', cep: '', endereco: '', bairro: '', situacao: 'Ativo', latitude: null, longitude: null })
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [cepEncontrado, setCepEncontrado] = useState(null) // null | true | false
  const [modoDia, setModoDia] = useState('auto') // 'auto' | 'manual'
  const [diaManual, setDiaManual] = useState('SEGUNDA')
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  const [modalVisita, setModalVisita] = useState(null)
  const [formVisita, setFormVisita] = useState({ status: 'Visitado', data: '', observacao: '' })
  const [salvandoVisita, setSalvandoVisita] = useState(false)

  const [filtroMes, setFiltroMes] = useState('')

  const [listaVendedores, setListaVendedores] = useState([])
  const [carregandoVendedores, setCarregandoVendedores] = useState(false)
  const [novoVendedor, setNovoVendedor] = useState({ nome: '', usuario: '', senha: '', admin: false })
  const [salvandoVendedor, setSalvandoVendedor] = useState(false)
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [diaComMapaAberto, setDiaComMapaAberto] = useState(null)

  useEffect(() => {
    if (vendedor) carregarTudo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedor?.id])

  useEffect(() => {
    if (aba === 'vendedores' && vendedor?.admin) carregarVendedores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba])

  // Busca automática de rua/bairro via ViaCEP, assim que o CEP tiver 8 dígitos.
  // Em seguida, geocodifica o endereço (Nominatim/OpenStreetMap, gratuito) para
  // obter latitude/longitude — usadas no mapa e na ordenação por proximidade.
  // Debounce de 400ms para não disparar uma busca a cada tecla.
  useEffect(() => {
    const digitos = (novoCliente.cep || '').replace(/\D/g, '')
    if (digitos.length !== 8) { setCepEncontrado(null); return }

    let cancelado = false
    const timer = setTimeout(async () => {
      setBuscandoCep(true)
      setCepEncontrado(null)
      try {
        const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
        const dados = await resp.json()
        if (cancelado) return
        if (dados.erro) {
          setCepEncontrado(false)
        } else {
          setNovoCliente((prev) => ({
            ...prev,
            endereco: dados.logradouro ? dados.logradouro : prev.endereco,
            bairro: dados.bairro
              ? `${dados.bairro} - ${dados.localidade}/${dados.uf}`
              : `${dados.localidade}/${dados.uf}`,
          }))
          setCepEncontrado(true)

          // Geocodificacao: tenta achar coordenadas a partir do endereco completo.
          // Falha silenciosa - se nao achar, o cliente fica sem ponto no mapa,
          // mas o cadastro continua normal (zona/dia seguem vindo do CEP).
          try {
            const enderecoBusca = encodeURIComponent(
              `${dados.logradouro || ''}, ${dados.bairro || ''}, ${dados.localidade}, ${dados.uf}, Brasil`
            )
            const geoResp = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${enderecoBusca}`
            )
            const geoDados = await geoResp.json()
            if (!cancelado && Array.isArray(geoDados) && geoDados.length > 0) {
              setNovoCliente((prev) => ({
                ...prev,
                latitude: parseFloat(geoDados[0].lat),
                longitude: parseFloat(geoDados[0].lon),
              }))
            }
          } catch {
            // sem coordenadas - tudo bem, segue o fluxo
          }
        }
      } catch {
        if (!cancelado) setCepEncontrado(false)
      } finally {
        if (!cancelado) setBuscandoCep(false)
      }
    }, 400)

    return () => { cancelado = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novoCliente.cep])

  async function carregarTudo() {
    if (!vendedor) return
    setCarregando(true)
    setErro('')
    try {
      const { data: cli, error: e1 } = await supabase
        .from('carteira_clientes')
        .select('*')
        .eq('vendedor_id', vendedor.id)
        .order('nome')
      if (e1) throw e1

      const idsCliente = (cli || []).map((c) => c.id)
      let vis = []
      if (idsCliente.length > 0) {
        const { data: visData, error: e2 } = await supabase
          .from('carteira_visitas')
          .select('*')
          .in('cliente_id', idsCliente)
          .order('data_visita', { ascending: false })
        if (e2) throw e2
        vis = visData || []
      }

      setClientes(cli || [])
      setVisitas(vis)
    } catch (err) {
      setErro(
        'Não consegui carregar os dados (' + err.message + '). Se a tabela existe mas continua vazia ' +
        'aqui, o motivo mais comum é o RLS bloqueando a leitura — no SQL Editor do Supabase, rode: ' +
        '"ALTER TABLE carteira_clientes DISABLE ROW LEVEL SECURITY;" (e o mesmo para carteira_visitas, carteira_regras_cep e carteira_vendedores).'
      )
    } finally {
      setCarregando(false)
    }
  }

  async function entrar() {
    if (!usuarioDigitado || !senhaDigitada) { setErroSenha('Informe usuário e senha.'); return }
    setEntrando(true)
    setErroSenha('')
    try {
      const { data, error } = await supabase
        .from('carteira_vendedores')
        .select('*')
        .ilike('usuario', usuarioDigitado.trim())
        .eq('senha', senhaDigitada)
        .eq('ativo', true)
        .maybeSingle()
      if (error) throw error
      if (!data) { setErroSenha('Usuário ou senha incorretos.'); return }
      setVendedor(data)
    } catch (err) {
      setErroSenha('Não consegui validar o login: ' + err.message)
    } finally {
      setEntrando(false)
    }
  }

  function sair() {
    setVendedor(null)
    setUsuarioDigitado('')
    setSenhaDigitada('')
    setClientes([])
    setVisitas([])
    setAba('roteiro')
  }

  const ultimaVisitaPorCliente = useMemo(() => {
    const map = {}
    for (const v of visitas) {
      const atual = map[v.cliente_id]
      if (!atual) { map[v.cliente_id] = v; continue }
      const dAtual = atual.data_visita + 'T' + (atual.criado_em || '')
      const dNova = v.data_visita + 'T' + (v.criado_em || '')
      if (dNova > dAtual) map[v.cliente_id] = v
    }
    return map
  }, [visitas])

  function statusDoCliente(id) { return ultimaVisitaPorCliente[id]?.status || 'Pendente' }

  async function salvarNovoCliente(e) {
    e.preventDefault()
    if (!novoCliente.nome || !novoCliente.cep) { setErro('Informe ao menos o nome e o CEP.'); return }
    setSalvandoCliente(true); setErro('')
    try {
      const { data: inserido, error } = await supabase
        .from('carteira_clientes')
        .insert([{ ...novoCliente, vendedor_id: vendedor.id }])
        .select()
        .single()
      if (error) throw error
      // o cadastro sempre calcula o dia pelo CEP primeiro; se o usuario escolheu
      // encaixar manualmente, sobrescrevemos o dia logo em seguida
      if (modoDia === 'manual' && inserido) {
        const { error: e2 } = await supabase.from('carteira_clientes').update({ dia_sugerido: diaManual }).eq('id', inserido.id)
        if (e2) throw e2
      }
      setNovoCliente({ nome: '', cnpj: '', cep: '', endereco: '', bairro: '', situacao: 'Ativo', latitude: null, longitude: null })
      setModoDia('auto')
      setDiaManual('SEGUNDA')
      setCepEncontrado(null)
      await carregarTudo()
    } catch (err) { setErro('Não consegui salvar o cliente: ' + err.message) }
    finally { setSalvandoCliente(false) }
  }

  async function alterarDia(clienteId, novoDia) {
    // atualiza so o dia_sugerido (nunca o cep), entao o gatilho automatico por CEP nao
    // sobrescreve essa escolha manual
    setClientes((prev) => prev.map((c) => c.id === clienteId ? { ...c, dia_sugerido: novoDia } : c))
    try {
      const { error } = await supabase.from('carteira_clientes').update({ dia_sugerido: novoDia }).eq('id', clienteId)
      if (error) throw error
    } catch (err) {
      setErro('Não consegui salvar o dia: ' + err.message)
      await carregarTudo()
    }
  }

  async function alterarSituacao(clienteId, novaSituacao) {
    // atualiza a tela na hora (otimista) e confirma no banco em seguida
    setClientes((prev) => prev.map((c) => c.id === clienteId ? { ...c, situacao: novaSituacao } : c))
    try {
      const { error } = await supabase.from('carteira_clientes').update({ situacao: novaSituacao }).eq('id', clienteId)
      if (error) throw error
    } catch (err) {
      setErro('Não consegui salvar a situação: ' + err.message)
      await carregarTudo()
    }
  }

  function abrirModalVisita(cliente) {
    setModalVisita({ clienteId: cliente.id, nome: cliente.nome })
    setFormVisita({ status: 'Visitado', data: new Date().toISOString().slice(0, 10), observacao: '' })
  }

  async function salvarVisita(e) {
    e.preventDefault()
    if (!modalVisita) return
    setSalvandoVisita(true); setErro('')
    try {
      const { error } = await supabase.from('carteira_visitas').insert([{
        cliente_id: modalVisita.clienteId, data_visita: formVisita.data,
        status: formVisita.status, observacao: formVisita.observacao,
      }])
      if (error) throw error
      setModalVisita(null)
      await carregarTudo()
    } catch (err) { setErro('Não consegui registrar a visita: ' + err.message) }
    finally { setSalvandoVisita(false) }
  }

  const clientesPorDia = useMemo(() => {
    const map = {}
    for (const d of DIAS) map[d] = []
    const outros = []
    const base = mostrarInativos ? clientes : clientes.filter((c) => (c.situacao || 'Ativo') !== 'Inativo')
    for (const c of base) {
      if (DIAS.includes(c.dia_sugerido)) map[c.dia_sugerido].push(c)
      else outros.push(c)
    }
    return { map, outros }
  }, [clientes, mostrarInativos])

  const painelPorDia = useMemo(() => DIAS.map((d) => {
    const lista = clientesPorDia.map[d]
    const total = lista.length
    const visitados = lista.filter((c) => statusDoCliente(c.id) === 'Visitado').length
    const pendentes = lista.filter((c) => statusDoCliente(c.id) === 'Pendente').length
    const reagendados = lista.filter((c) => statusDoCliente(c.id) === 'Reagendado').length
    return { dia: d, total, visitados, pendentes, reagendados }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [clientesPorDia, ultimaVisitaPorCliente])

  const visitasFiltradas = useMemo(() => {
    if (!filtroMes) return visitas
    return visitas.filter((v) => (v.data_visita || '').startsWith(filtroMes))
  }, [visitas, filtroMes])

  function nomeCliente(id) { return clientes.find((c) => c.id === id)?.nome || '(cliente removido)' }

  async function carregarVendedores() {
    setCarregandoVendedores(true)
    try {
      const { data, error } = await supabase.from('carteira_vendedores').select('*').order('nome')
      if (error) throw error
      setListaVendedores(data || [])
    } catch (err) {
      setErro('Não consegui carregar os vendedores: ' + err.message)
    } finally {
      setCarregandoVendedores(false)
    }
  }

  async function salvarNovoVendedor(e) {
    e.preventDefault()
    if (!novoVendedor.nome || !novoVendedor.usuario || !novoVendedor.senha) {
      setErro('Preencha nome, usuário e senha do novo vendedor.')
      return
    }
    setSalvandoVendedor(true); setErro('')
    try {
      const { error } = await supabase.from('carteira_vendedores').insert([{
        nome: novoVendedor.nome,
        usuario: novoVendedor.usuario.trim().toLowerCase(),
        senha: novoVendedor.senha,
        admin: novoVendedor.admin,
      }])
      if (error) throw error
      setNovoVendedor({ nome: '', usuario: '', senha: '', admin: false })
      await carregarVendedores()
    } catch (err) {
      if ((err.message || '').includes('duplicate') || (err.message || '').includes('unique')) {
        setErro('Já existe um vendedor com esse usuário — escolha outro nome de usuário.')
      } else {
        setErro('Não consegui criar o vendedor: ' + err.message)
      }
    } finally {
      setSalvandoVendedor(false)
    }
  }

  async function alternarAtivoVendedor(id, ativoAtual) {
    setListaVendedores((prev) => prev.map((v) => v.id === id ? { ...v, ativo: !ativoAtual } : v))
    try {
      const { error } = await supabase.from('carteira_vendedores').update({ ativo: !ativoAtual }).eq('id', id)
      if (error) throw error
    } catch (err) {
      setErro('Não consegui atualizar o vendedor: ' + err.message)
      await carregarVendedores()
    }
  }

  const totalVisitado = clientes.filter((c) => statusDoCliente(c.id) === 'Visitado').length
  const totalPendente = clientes.filter((c) => statusDoCliente(c.id) === 'Pendente').length

  if (!autenticado) {
    return (
      <div className="av-root">
        <FontLoader />
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: COR.ink, padding: 20,
        }}>
          <div style={{ width: 360 }}>
            <div style={{ marginBottom: 28, textAlign: 'center' }}>
              <div className="av-display" style={{ color: COR.amber, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em' }}>
                LIMPAR AUTO
              </div>
              <div className="av-display" style={{ color: COR.textOnInk, fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                Carteira de Visitas
              </div>
            </div>
            <Painel style={{ background: COR.paperRaised }}>
              <Campo
                label="Usuário"
                value={usuarioDigitado}
                onChange={(e) => setUsuarioDigitado(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && entrar()}
                autoFocus
                style={{ marginBottom: 12 }}
              />
              <Campo
                label="Senha"
                type="password"
                value={senhaDigitada}
                onChange={(e) => setSenhaDigitada(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && entrar()}
              />
              {erroSenha && (
                <p style={{ color: '#8C3F4F', fontSize: 12.5, marginTop: 8, marginBottom: 0 }}>{erroSenha}</p>
              )}
              <Botao variant="amber" onClick={entrar} disabled={entrando} style={{ width: '100%', marginTop: 16 }}>
                {entrando ? 'Entrando…' : 'Entrar'}
              </Botao>
            </Painel>
          </div>
        </div>
      </div>
    )
  }

  const abas = [
    ['roteiro', 'Roteiro semanal'],
    ['clientes', 'Clientes'],
    ['historico', 'Histórico'],
    ['painel', 'Painel'],
    ...(vendedor?.admin ? [['vendedores', 'Vendedores']] : []),
  ]

  return (
    <div className="av-root" style={{ minHeight: '100vh', background: COR.paper }}>
      <FontLoader />

      <header style={{ background: COR.ink, padding: '20px 28px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: COR.amber, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em' }}>
              LIMPAR AUTO · BASE SP
            </div>
            <div className="av-display" style={{ color: COR.textOnInk, fontSize: 22, fontWeight: 700, marginTop: 3 }}>
              Carteira de Visitas
            </div>
          </div>
          <div className="av-mono" style={{ color: COR.textOnInkSoft, fontSize: 12, textAlign: 'right' }}>
            <div style={{ color: COR.textOnInk, fontWeight: 700, marginBottom: 4 }}>
              {vendedor?.nome}
              <button onClick={sair} style={{
                marginLeft: 12, border: 'none', background: 'none', color: COR.amber,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>sair</button>
            </div>
            <div>{totalVisitado} visitados · {totalPendente} pendentes</div>
            <div>{clientes.length} clientes na carteira</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 4, marginTop: 22 }}>
          {abas.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '10px 4px', marginRight: 22,
                fontSize: 13.5, fontWeight: 600,
                color: aba === key ? COR.textOnInk : COR.textOnInkSoft,
                borderBottom: aba === key ? `2px solid ${COR.amber}` : '2px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ padding: '24px 28px 60px', maxWidth: 1180, margin: '0 auto' }}>
        {erro && (
          <Painel style={{ background: '#FBEEEC', borderColor: '#E2B6AC', color: '#7A3328', marginBottom: 18, fontSize: 13.5, lineHeight: 1.5 }}>
            {erro}
          </Painel>
        )}
        {carregando && <p style={{ color: COR.textSecondary }}>Carregando carteira…</p>}

        {!carregando && aba === 'roteiro' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: COR.textSecondary, cursor: 'pointer' }}>
                <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
                Mostrar clientes inativos na rota
              </label>
            </div>
            {clientes.length === 0 && !erro && (
              <Painel>
                <p style={{ margin: 0, color: COR.textSecondary, fontSize: 14 }}>
                  Nenhum cliente na carteira ainda. Cadastre o primeiro na aba <strong>Clientes</strong>.
                </p>
              </Painel>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 0 }}>
              {DIAS.map((d, idx) => {
                const lc = LINHA_DIA[d]
                const lista = clientesPorDia.map[d]
                const comCoord = lista.filter((c) => c.latitude && c.longitude)
                const ordenados = ordenarPorProximidade(comCoord, CASA_BASE)
                const linkRota = linkGoogleMaps(ordenados)
                const mapaAberto = diaComMapaAberto === d
                return (
                  <div key={d} style={{
                    padding: '0 16px',
                    borderLeft: idx === 0 ? 'none' : `1px solid ${COR.line}`,
                  }}>
                    <div style={{ marginBottom: 12 }}>
                      <div className="av-display" style={{ fontSize: 15, fontWeight: 700, color: COR.textPrimary }}>
                        {d}
                      </div>
                      <div style={{ fontSize: 11.5, color: COR.textSecondary, marginTop: 2 }}>
                        {lista.length} {lista.length === 1 ? 'parada' : 'paradas'}
                        {comCoord.length > 0 && comCoord.length < lista.length && (
                          <> · {comCoord.length} no mapa</>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setDiaComMapaAberto(mapaAberto ? null : d)}
                          style={{
                            border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                            fontSize: 11.5, fontWeight: 600, color: COR.amberDeep,
                          }}
                        >
                          {mapaAberto ? 'ocultar mapa' : 'ver mapa do dia'}
                        </button>
                        {linkRota && (
                          <a href={linkRota} target="_blank" rel="noreferrer" style={{
                            fontSize: 11.5, fontWeight: 600, color: COR.amberDeep, textDecoration: 'none',
                          }}>
                            abrir rota no Google Maps →
                          </a>
                        )}
                      </div>
                    </div>

                    {mapaAberto && (
                      <div style={{ marginBottom: 16 }}>
                        <MapaDia pontos={ordenados} cor={lc.cor} />
                      </div>
                    )}

                    <div style={{ position: 'relative' }}>
                      {lista.length > 0 && (
                        <div style={{
                          position: 'absolute', left: 4, top: 6, bottom: 6, width: 2,
                          background: lc.cor, opacity: 0.35, borderRadius: 1,
                        }} />
                      )}
                      {(() => {
                        const semCoord = lista.filter((c) => !(c.latitude && c.longitude))
                        const listaExibicao = [...ordenados, ...semCoord]
                        return listaExibicao.map((c) => {
                        const st = STATUS_INFO[statusDoCliente(c.id)]
                        return (
                          <div key={c.id} style={{ position: 'relative', paddingLeft: 22, paddingBottom: 18 }}>
                            <div style={{
                              position: 'absolute', left: 0, top: 4, width: 10, height: 10, borderRadius: '50%',
                              background: COR.paper, border: `2px solid ${lc.cor}`,
                            }} />
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: COR.textPrimary, lineHeight: 1.3 }}>
                              {c.nome}
                            </div>
                            <div style={{ fontSize: 11.5, color: COR.textSecondary, marginTop: 2 }}>
                              {c.bairro}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                              <Etiqueta texto={c.status_rodizio} info={RODIZIO_INFO} />
                              <span style={{ width: 1, height: 10, background: COR.line }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: st.cor, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                {st.label}
                              </span>
                              {(c.situacao || 'Ativo') !== 'Ativo' && (
                                <>
                                  <span style={{ width: 1, height: 10, background: COR.line }} />
                                  <Etiqueta texto={c.situacao} info={SITUACAO_INFO} />
                                </>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 7 }}>
                              <button
                                onClick={() => abrirModalVisita(c)}
                                style={{
                                  border: 'none', background: 'none', padding: 0,
                                  color: COR.amberDeep, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                }}
                              >
                                Registrar visita →
                              </button>
                              <span style={{ width: 1, height: 10, background: COR.line }} />
                              <span style={{ fontSize: 11.5, color: COR.textSecondary }}>
                                mover p/ <SeletorDia cliente={c} onChange={alterarDia} />
                              </span>
                            </div>
                          </div>
                        )
                      })
                      })()}
                      {lista.length === 0 && (
                        <p style={{ color: COR.textSecondary, fontSize: 12.5, paddingLeft: 4 }}>Sem paradas.</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {clientesPorDia.outros.length > 0 && (
              <Painel style={{ marginTop: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: COR.textSecondary, marginBottom: 12 }}>
                  A CONFIRMAR — CEP AINDA NÃO MAPEADO ({clientesPorDia.outros.length})
                </div>
                {clientesPorDia.outros.map((c) => (
                  <div key={c.id} style={{ padding: '8px 0', borderBottom: `1px solid ${COR.lineSoft}`, fontSize: 13.5 }}>
                    <strong>{c.nome}</strong>
                    <span className="av-mono" style={{ color: COR.textSecondary, marginLeft: 8 }}>{c.cep}</span>
                    <span style={{ color: COR.textSecondary, marginLeft: 8 }}>{c.bairro}</span>
                  </div>
                ))}
              </Painel>
            )}
          </>
        )}

        {!carregando && aba === 'clientes' && (
          <>
            <Painel style={{ marginBottom: 20 }}>
              <div className="av-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                Cadastrar cliente
              </div>
              <form onSubmit={salvarNovoCliente}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                  <Campo label="Nome *" value={novoCliente.nome}
                    onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })} />
                  <Campo label="CNPJ" value={novoCliente.cnpj}
                    onChange={(e) => setNovoCliente({ ...novoCliente, cnpj: e.target.value })} />
                  <div style={{ position: 'relative' }}>
                    <Campo label="CEP *" placeholder="00000-000" value={novoCliente.cep}
                      onChange={(e) => setNovoCliente({ ...novoCliente, cep: e.target.value })} />
                    {buscandoCep && (
                      <span style={{ position: 'absolute', right: 10, bottom: 10, fontSize: 11, color: COR.textSecondary }}>
                        buscando…
                      </span>
                    )}
                  </div>
                  <Campo label="Endereço" value={novoCliente.endereco}
                    onChange={(e) => setNovoCliente({ ...novoCliente, endereco: e.target.value })} />
                  <Campo label="Bairro" value={novoCliente.bairro}
                    onChange={(e) => setNovoCliente({ ...novoCliente, bairro: e.target.value })} />
                  <label style={{ display: 'block', fontSize: 12 }}>
                    <span style={{ display: 'block', marginBottom: 5, color: COR.textSecondary, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10.5 }}>
                      Situação
                    </span>
                    <select
                      value={novoCliente.situacao}
                      onChange={(e) => setNovoCliente({ ...novoCliente, situacao: e.target.value })}
                      style={{ width: '100%', padding: '9px 11px', borderRadius: 4, border: `1px solid ${COR.line}`, fontSize: 14, background: COR.paper }}
                    >
                      {SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>

                {cepEncontrado === false && (
                  <p style={{ fontSize: 11.5, color: '#B6862F', marginTop: 8, marginBottom: 0 }}>
                    CEP não encontrado — preencha o endereço e o bairro manualmente.
                  </p>
                )}
                {cepEncontrado === true && (
                  <p style={{ fontSize: 11.5, color: novoCliente.latitude ? '#3F6B4D' : '#B6862F', marginTop: 8, marginBottom: 0 }}>
                    {novoCliente.latitude
                      ? '📍 Endereço e localização encontrados — vai aparecer no mapa.'
                      : 'Endereço encontrado, mas não consegui localizar no mapa — o cliente ainda entra no roteiro normalmente, só não aparece no mapa visual.'}
                  </p>
                )}

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${COR.lineSoft}` }}>
                  <span style={{ display: 'block', marginBottom: 8, color: COR.textSecondary, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10.5 }}>
                    Encaixe na rota
                  </span>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" name="modoDia" checked={modoDia === 'auto'}
                        onChange={() => setModoDia('auto')} />
                      Automático pelo CEP
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" name="modoDia" checked={modoDia === 'manual'}
                        onChange={() => setModoDia('manual')} />
                      Escolher o dia
                    </label>
                    {modoDia === 'manual' && (
                      <select
                        value={diaManual}
                        onChange={(e) => setDiaManual(e.target.value)}
                        style={{ padding: '8px 11px', borderRadius: 4, border: `1px solid ${COR.line}`, fontSize: 13.5, background: COR.paper }}
                      >
                        {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    )}
                  </div>
                  {modoDia === 'manual' && (
                    <p style={{ fontSize: 11.5, color: COR.textSecondary, marginTop: 8, marginBottom: 0 }}>
                      A zona e o status do rodízio ainda são calculados pelo CEP — só o dia da semana fica fixo no que você escolher.
                    </p>
                  )}
                </div>

                <Botao type="submit" variant="amber" disabled={salvandoCliente} style={{ marginTop: 16 }}>
                  {salvandoCliente ? 'Salvando…' : 'Salvar cliente'}
                </Botao>
              </form>
            </Painel>

            <Painel>
              <div className="av-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                Todos os clientes ({clientes.length})
              </div>
              <div className="av-scroll" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: `1px solid ${COR.line}` }}>
                      {['Nome', 'CEP', 'Bairro', 'Dia', 'Rodízio', 'Situação', 'Status', ''].map((h) => (
                        <th key={h} style={{
                          padding: '0 10px 10px 0', fontSize: 10.5, fontWeight: 700,
                          color: COR.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c) => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${COR.lineSoft}` }}>
                        <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{c.nome}</td>
                        <td className="av-mono" style={{ padding: '10px 10px 10px 0', color: COR.textSecondary }}>{c.cep}</td>
                        <td style={{ padding: '10px 10px 10px 0', color: COR.textSecondary }}>{c.bairro}</td>
                        <td style={{ padding: '10px 10px 10px 0' }}><SeletorDia cliente={c} onChange={alterarDia} /></td>
                        <td style={{ padding: '10px 10px 10px 0' }}><Etiqueta texto={c.status_rodizio} info={RODIZIO_INFO} /></td>
                        <td style={{ padding: '10px 10px 10px 0' }}>
                          <SeletorSituacao cliente={c} onChange={alterarSituacao} />
                        </td>
                        <td style={{ padding: '10px 10px 10px 0' }}><Etiqueta texto={statusDoCliente(c.id)} info={STATUS_INFO} /></td>
                        <td style={{ padding: '10px 0' }}>
                          <button onClick={() => abrirModalVisita(c)} style={{
                            border: 'none', background: 'none', color: COR.amberDeep,
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}>visitar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clientes.length === 0 && !erro && (
                  <p style={{ color: COR.textSecondary, fontSize: 13, padding: '12px 0' }}>Nenhum cliente cadastrado ainda.</p>
                )}
              </div>
            </Painel>
          </>
        )}

        {!carregando && aba === 'historico' && (
          <Painel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
              <div className="av-display" style={{ fontSize: 15, fontWeight: 700 }}>Histórico de visitas</div>
              <input
                type="month"
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                style={{ padding: 8, borderRadius: 4, border: `1px solid ${COR.line}`, fontSize: 13 }}
              />
              {filtroMes && (
                <button onClick={() => setFiltroMes('')} style={{
                  border: 'none', background: 'none', color: COR.textSecondary, cursor: 'pointer', fontSize: 12.5,
                }}>limpar filtro</button>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${COR.line}` }}>
                  {['Data', 'Cliente', 'Status', 'Observação'].map((h) => (
                    <th key={h} style={{
                      padding: '0 10px 10px 0', fontSize: 10.5, fontWeight: 700,
                      color: COR.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitasFiltradas.map((v) => (
                  <tr key={v.id} style={{ borderBottom: `1px solid ${COR.lineSoft}` }}>
                    <td className="av-mono" style={{ padding: '10px 10px 10px 0', color: COR.textSecondary }}>{v.data_visita}</td>
                    <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{nomeCliente(v.cliente_id)}</td>
                    <td style={{ padding: '10px 10px 10px 0' }}><Etiqueta texto={v.status} info={STATUS_INFO} /></td>
                    <td style={{ padding: '10px 0', color: COR.textSecondary }}>{v.observacao}</td>
                  </tr>
                ))}
                {visitasFiltradas.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '16px 0', textAlign: 'center', color: COR.textSecondary }}>
                    Nenhuma visita registrada {filtroMes ? 'neste mês' : 'ainda'}.
                  </td></tr>
                )}
              </tbody>
            </table>
          </Painel>
        )}

        {!carregando && aba === 'painel' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, marginBottom: 24, background: COR.line }}>
              {[
                ['Total na carteira', clientes.length, COR.textPrimary],
                ['Visitados', totalVisitado, '#3F6B4D'],
                ['Pendentes', totalPendente, '#B6862F'],
                ['Registros no histórico', visitas.length, COR.amberDeep],
              ].map(([label, valor, cor]) => (
                <div key={label} style={{ background: COR.paperRaised, padding: '18px 16px' }}>
                  <div className="av-mono" style={{ fontSize: 30, fontWeight: 500, color: cor }}>{valor}</div>
                  <div style={{ fontSize: 11.5, color: COR.textSecondary, marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            <Painel>
              <div className="av-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                Progresso por dia
              </div>
              {painelPorDia.map((p) => {
                const pct = p.total ? Math.round((p.visitados / p.total) * 100) : 0
                return (
                  <div key={p.dia} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: LINHA_DIA[p.dia].cor }}>{p.dia}</span>
                      <span className="av-mono" style={{ color: COR.textSecondary }}>
                        {p.visitados}/{p.total} · {pct}%
                      </span>
                    </div>
                    <div style={{ height: 6, background: COR.lineSoft, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: LINHA_DIA[p.dia].cor, borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </Painel>
          </>
        )}

        {aba === 'vendedores' && vendedor?.admin && (
          <>
            <Painel style={{ marginBottom: 20 }}>
              <div className="av-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                Adicionar vendedor
              </div>
              <form onSubmit={salvarNovoVendedor}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                  <Campo label="Nome *" value={novoVendedor.nome}
                    onChange={(e) => setNovoVendedor({ ...novoVendedor, nome: e.target.value })} />
                  <Campo label="Usuário (login) *" value={novoVendedor.usuario}
                    onChange={(e) => setNovoVendedor({ ...novoVendedor, usuario: e.target.value })} />
                  <Campo label="Senha *" value={novoVendedor.senha}
                    onChange={(e) => setNovoVendedor({ ...novoVendedor, senha: e.target.value })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, paddingTop: 18 }}>
                    <input type="checkbox" checked={novoVendedor.admin}
                      onChange={(e) => setNovoVendedor({ ...novoVendedor, admin: e.target.checked })} />
                    Também é administrador
                  </label>
                </div>
                <Botao type="submit" variant="amber" disabled={salvandoVendedor} style={{ marginTop: 16 }}>
                  {salvandoVendedor ? 'Salvando…' : 'Salvar vendedor'}
                </Botao>
              </form>
            </Painel>

            <Painel>
              <div className="av-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                Equipe ({listaVendedores.length})
              </div>
              {carregandoVendedores && <p style={{ color: COR.textSecondary }}>Carregando…</p>}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: `1px solid ${COR.line}` }}>
                    {['Nome', 'Usuário', 'Admin', 'Status', ''].map((h) => (
                      <th key={h} style={{
                        padding: '0 10px 10px 0', fontSize: 10.5, fontWeight: 700,
                        color: COR.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listaVendedores.map((v) => (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${COR.lineSoft}` }}>
                      <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{v.nome}</td>
                      <td className="av-mono" style={{ padding: '10px 10px 10px 0', color: COR.textSecondary }}>{v.usuario}</td>
                      <td style={{ padding: '10px 10px 10px 0' }}>{v.admin ? 'Sim' : '—'}</td>
                      <td style={{ padding: '10px 10px 10px 0' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: v.ativo ? '#3F6B4D' : '#8A8377', textTransform: 'uppercase' }}>
                          {v.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        {v.id !== vendedor.id && (
                          <button onClick={() => alternarAtivoVendedor(v.id, v.ativo)} style={{
                            border: 'none', background: 'none', color: COR.amberDeep,
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}>
                            {v.ativo ? 'desativar' : 'reativar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {listaVendedores.length === 0 && !carregandoVendedores && (
                <p style={{ color: COR.textSecondary, fontSize: 13, padding: '12px 0' }}>Nenhum vendedor cadastrado ainda.</p>
              )}
              <p style={{ fontSize: 11.5, color: COR.textSecondary, marginTop: 14 }}>
                Desativar um vendedor impede o login dele, mas não apaga a carteira de clientes já cadastrada.
              </p>
            </Painel>
          </>
        )}
      </main>

      {modalVisita && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,24,31,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20,
        }}>
          <div style={{ width: 380, background: COR.paperRaised, borderRadius: 6, padding: 24 }}>
            <div className="av-display" style={{ fontSize: 16, fontWeight: 700 }}>Registrar visita</div>
            <p style={{ color: COR.textSecondary, fontSize: 13.5, marginTop: 4, marginBottom: 18 }}>{modalVisita.nome}</p>
            <form onSubmit={salvarVisita}>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COR.textSecondary, letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 5 }}>
                Status
              </label>
              <select
                value={formVisita.status}
                onChange={(e) => setFormVisita({ ...formVisita, status: e.target.value })}
                style={{ width: '100%', padding: 9, borderRadius: 4, border: `1px solid ${COR.line}`, marginBottom: 12, fontSize: 14 }}
              >
                <option value="Visitado">Visitado</option>
                <option value="Reagendado">Reagendado</option>
                <option value="Cancelado">Cancelado</option>
              </select>

              <Campo label="Data" type="date" value={formVisita.data}
                onChange={(e) => setFormVisita({ ...formVisita, data: e.target.value })}
                style={{ marginBottom: 12 }} />

              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COR.textSecondary, letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 5 }}>
                Observação
              </label>
              <textarea
                value={formVisita.observacao}
                onChange={(e) => setFormVisita({ ...formVisita, observacao: e.target.value })}
                rows={3}
                style={{ width: '100%', padding: 9, borderRadius: 4, border: `1px solid ${COR.line}`, marginBottom: 16, fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <Botao type="submit" variant="amber" disabled={salvandoVisita}>
                  {salvandoVisita ? 'Salvando…' : 'Salvar visita'}
                </Botao>
                <Botao variant="ghost" onClick={() => setModalVisita(null)}>Cancelar</Botao>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

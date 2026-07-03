import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import * as XLSX from 'xlsx'

// =====================================================================
// SISTEMA DE DESIGN — "Painel de Despacho"
// Inspirado em mapas de roteiro/metrô: cada dia e uma linha, cada
// cliente e uma parada. Paleta grafite + papel + ambar de sinalizacao.
// =====================================================================

// A senha unica fixa deu lugar ao login por vendedor (tabela carteira_vendedores)

const COR = {
  ink: '#14181F',
  inkSoft: '#1E2430',
  paper: '#14161C',
  paperRaised: '#1A1D26',
  line: 'rgba(212,175,55,0.18)',
  lineSoft: 'rgba(255,255,255,0.08)',
  amber: '#D4AF37',
  amberDeep: '#E8C86A',
  textPrimary: '#F5F1E8',
  textSecondary: '#9A9488',
  textOnInk: '#F6F4EF',
  textOnInkSoft: '#9CA3AF',
}

// Paleta "Premium" - agora aplicada em todo o app. Mantida separada dos
// tokens COR acima porque o cabeçalho/nav usam gradiente e brilho próprios
// que não fazem sentido como tokens de card comuns.
const PREM = {
  bgPage: '#101115',
  glass: 'rgba(26,29,38,0.78)',
  glassBorder: 'rgba(212,175,55,0.16)',
  gold: '#D4AF37',
  goldSoft: '#E8C86A',
  goldOn: '#1C1A14',
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
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Fraunces:wght@600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      .av-root, .av-root * { font-family: 'Inter', system-ui, sans-serif; }
      .av-display { font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif; }
      .av-serif { font-family: 'Fraunces', serif; }
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
// Ponto de partida usado só se o vendedor ainda não cadastrou o próprio
// endereço residencial no "Meu Perfil" (fallback, região de Taboão da Serra).
const CASA_BASE_PADRAO = { lat: -23.6229, lng: -46.7817 }

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

function linkGoogleMaps(pontosOrdenados, origemCasa) {
  if (pontosOrdenados.length === 0) return null
  const origin = `${origemCasa.lat},${origemCasa.lng}`
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

// Detecta o dia da semana de hoje (no formato usado pelo resto do app).
// Sábado e domingo não têm rota cadastrada (retorna null).
function diaSemanaHoje() {
  const mapa = { 1: 'SEGUNDA', 2: 'TERÇA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA' }
  return mapa[new Date().getDay()] || null
}

// Regra oficial do rodízio em São Paulo: o dia de restrição depende do
// último número da placa (funciona com placa antiga ou Mercosul).
function diaRodizioPorPlaca(placa) {
  const digitos = String(placa || '').replace(/\D/g, '')
  if (!digitos) return null
  const ultimo = digitos[digitos.length - 1]
  const mapa = {
    '1': 'SEGUNDA', '2': 'SEGUNDA',
    '3': 'TERÇA', '4': 'TERÇA',
    '5': 'QUARTA', '6': 'QUARTA',
    '7': 'QUINTA', '8': 'QUINTA',
    '9': 'SEXTA', '0': 'SEXTA',
  }
  return mapa[ultimo] || null
}

// =====================================================================
// IMPORTAÇÃO DE PLANILHA — identifica as colunas automaticamente,
// não importa como o usuário nomeou ("Cliente" ou "Nome", "Cep" ou "CEP")
// =====================================================================

function normalizarTexto(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function acharColuna(headers, candidatos) {
  for (const h of headers) {
    const hn = normalizarTexto(h)
    if (candidatos.some((c) => hn === c || hn.includes(c))) return h
  }
  return null
}

// Quando o Excel guarda o CEP como número (em vez de texto), o zero da
// frente some - ex: "06328-150" vira 6328150. Completa de volta pra 8
// dígitos nesse caso, igual já fazemos no cadastro manual.
function normalizarCep(valor) {
  const bruto = String(valor || '').trim()
  if (/^\d+$/.test(bruto) && bruto.length < 8) {
    return bruto.padStart(8, '0')
  }
  return bruto
}

function lerPlanilhaClientes(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json(ws, { defval: '' })
  if (linhas.length === 0) return []

  const headers = Object.keys(linhas[0])
  const colNome = acharColuna(headers, ['cliente', 'nome', 'razao social'])
  const colCnpj = acharColuna(headers, ['cnpj'])
  const colCep = acharColuna(headers, ['cep'])
  const colEndereco = acharColuna(headers, ['endereco', 'rua', 'logradouro'])
  const colBairro = acharColuna(headers, ['bairro'])

  return linhas
    .map((l) => ({
      nome: String(colNome ? l[colNome] : '').trim(),
      cnpj: String(colCnpj ? l[colCnpj] : '').trim(),
      cep: normalizarCep(colCep ? l[colCep] : ''),
      endereco: String(colEndereco ? l[colEndereco] : '').trim(),
      bairro: String(colBairro ? l[colBairro] : '').trim(),
    }))
    .filter((r) => r.nome && r.cep)
}

// Busca endereco (ViaCEP) e coordenadas (Nominatim) a partir de um CEP.
// Usada tanto no cadastro individual quanto na importacao em massa.
// Busca coordenadas direto pelo CEP, em 3 camadas: primeiro os serviços
// brasileiros feitos especificamente pra isso (BrasilAPI, AwesomeAPI - bem
// mais precisos que geocodificação por texto), e só por último tenta
// "adivinhar" a partir do endereço via Nominatim/OpenStreetMap.
async function buscarCoordenadasPorCep(cepDigitos, enderecoTextoFallback) {
  // 1) BrasilAPI v2 - agrega múltiplos provedores, costuma ter a melhor cobertura
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepDigitos}`)
    if (resp.ok) {
      const dados = await resp.json()
      const lat = dados?.location?.coordinates?.latitude
      const lng = dados?.location?.coordinates?.longitude
      if (lat && lng) return { latitude: parseFloat(lat), longitude: parseFloat(lng) }
    }
  } catch {
    // segue pra próxima fonte
  }

  // 2) AwesomeAPI - outra base brasileira, formato mais simples
  try {
    const resp = await fetch(`https://cep.awesomeapi.com.br/json/${cepDigitos}`)
    if (resp.ok) {
      const dados = await resp.json()
      if (dados?.lat && dados?.lng) {
        return { latitude: parseFloat(dados.lat), longitude: parseFloat(dados.lng) }
      }
    }
  } catch {
    // segue pra próxima fonte
  }

  // 3) Último recurso: geocodificação genérica por texto do endereço
  if (enderecoTextoFallback) {
    try {
      const geoResp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(enderecoTextoFallback)}`
      )
      const geoDados = await geoResp.json()
      if (Array.isArray(geoDados) && geoDados.length > 0) {
        return { latitude: parseFloat(geoDados[0].lat), longitude: parseFloat(geoDados[0].lon) }
      }
    } catch {
      // nenhuma fonte encontrou - retorna nulo mesmo
    }
  }

  return { latitude: null, longitude: null }
}

async function buscarEnderecoEGeo(cepDigitos) {
  const resultado = { encontrado: false, endereco: '', bairro: '', latitude: null, longitude: null }
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cepDigitos}/json/`)
    const dados = await resp.json()
    if (dados.erro) return resultado

    resultado.encontrado = true
    resultado.endereco = dados.logradouro || ''
    resultado.bairro = dados.bairro
      ? `${dados.bairro} - ${dados.localidade}/${dados.uf}`
      : `${dados.localidade}/${dados.uf}`

    const enderecoTexto = `${dados.logradouro || ''}, ${dados.bairro || ''}, ${dados.localidade}, ${dados.uf}, Brasil`
    const coords = await buscarCoordenadasPorCep(cepDigitos, enderecoTexto)
    resultado.latitude = coords.latitude
    resultado.longitude = coords.longitude
  } catch {
    // CEP nao encontrado ou falha de rede - resultado.encontrado fica false
  }
  return resultado
}

export default function AdminVisitas() {
  const [vendedor, setVendedor] = useState(null) // { id, nome, usuario, admin } | null
  const [usuarioDigitado, setUsuarioDigitado] = useState('')
  const [senhaDigitada, setSenhaDigitada] = useState('')
  const [erroSenha, setErroSenha] = useState('')
  const [entrando, setEntrando] = useState(false)
  const autenticado = !!vendedor

  const [aba, setAba] = useState('hoje')
  const [clientes, setClientes] = useState([])
  const [visitas, setVisitas] = useState([])
  const [reposicoes, setReposicoes] = useState([]) // [{ id, visita_id, produto, quantidade_litros }]
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [novoCliente, setNovoCliente] = useState({ nome: '', cnpj: '', cep: '', endereco: '', bairro: '', situacao: 'Ativo', latitude: null, longitude: null })
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [cepEncontrado, setCepEncontrado] = useState(null) // null | true | false

  const [importando, setImportando] = useState(false)
  const [progressoImport, setProgressoImport] = useState([]) // [{ nome, status, mensagem }]
  const [resumoImport, setResumoImport] = useState(null) // { total, ok, erro } | null
  const inputArquivoRef = useRef(null)
  const [modoDia, setModoDia] = useState('auto') // 'auto' | 'manual'
  const [diaManual, setDiaManual] = useState('SEGUNDA')

  const [corrigindoLocalizacao, setCorrigindoLocalizacao] = useState(false)
  const [progressoLocalizacao, setProgressoLocalizacao] = useState([]) // [{ nome, status, mensagem }]
  const [resumoLocalizacao, setResumoLocalizacao] = useState(null)
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  const [modalVisita, setModalVisita] = useState(null)
  const [formVisita, setFormVisita] = useState({
    status: 'Visitado', data: '', observacao: '',
    teve_reposicao: false,
    reposicao: { 'Verniz de Motor': '', 'Limpa Freio': '', 'Sanitizante': '' },
  })

const PRODUTOS = ['Verniz de Motor', 'Limpa Freio', 'Sanitizante']
  const [salvandoVisita, setSalvandoVisita] = useState(false)

  const [filtroMes, setFiltroMes] = useState('')

  const [listaVendedores, setListaVendedores] = useState([])

  const [perfilForm, setPerfilForm] = useState({
    cep_residencial: '', endereco_residencial: '', bairro_residencial: '',
    latitude_residencial: null, longitude_residencial: null, placa: '',
  })
  const [buscandoCepPerfil, setBuscandoCepPerfil] = useState(false)
  const [cepPerfilEncontrado, setCepPerfilEncontrado] = useState(null)
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [perfilSalvo, setPerfilSalvo] = useState(false)
  const [carregandoVendedores, setCarregandoVendedores] = useState(false)
  const [novoVendedor, setNovoVendedor] = useState({ nome: '', usuario: '', senha: '', admin: false })
  const [salvandoVendedor, setSalvandoVendedor] = useState(false)
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [diaComMapaAberto, setDiaComMapaAberto] = useState(diaSemanaHoje())

  useEffect(() => {
    if (vendedor) carregarTudo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedor?.id])

  useEffect(() => {
    if (vendedor) {
      setPerfilForm({
        cep_residencial: vendedor.cep_residencial || '',
        endereco_residencial: vendedor.endereco_residencial || '',
        bairro_residencial: vendedor.bairro_residencial || '',
        latitude_residencial: vendedor.latitude_residencial || null,
        longitude_residencial: vendedor.longitude_residencial || null,
        placa: vendedor.placa || '',
      })
    }
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
      const r = await buscarEnderecoEGeo(digitos)
      if (cancelado) return
      if (!r.encontrado) {
        setCepEncontrado(false)
      } else {
        setNovoCliente((prev) => ({
          ...prev,
          endereco: r.endereco || prev.endereco,
          bairro: r.bairro || prev.bairro,
          latitude: r.latitude,
          longitude: r.longitude,
        }))
        setCepEncontrado(true)
      }
      if (!cancelado) setBuscandoCep(false)
    }, 400)

    return () => { cancelado = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novoCliente.cep])

  // Mesma busca automática de endereço, agora para o CEP residencial do perfil.
  useEffect(() => {
    const digitos = (perfilForm.cep_residencial || '').replace(/\D/g, '')
    if (digitos.length !== 8) { setCepPerfilEncontrado(null); return }

    let cancelado = false
    const timer = setTimeout(async () => {
      setBuscandoCepPerfil(true)
      setCepPerfilEncontrado(null)
      const r = await buscarEnderecoEGeo(digitos)
      if (cancelado) return
      if (!r.encontrado) {
        setCepPerfilEncontrado(false)
      } else {
        setPerfilForm((prev) => ({
          ...prev,
          endereco_residencial: r.endereco || prev.endereco_residencial,
          bairro_residencial: r.bairro || prev.bairro_residencial,
          latitude_residencial: r.latitude,
          longitude_residencial: r.longitude,
        }))
        setCepPerfilEncontrado(true)
      }
      if (!cancelado) setBuscandoCepPerfil(false)
    }, 400)

    return () => { cancelado = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilForm.cep_residencial])

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

      // Busca reposicoes vinculadas a essas visitas
      const idsVisita = vis.map((v) => v.id)
      if (idsVisita.length > 0) {
        const { data: repData } = await supabase
          .from('carteira_reposicoes')
          .select('*')
          .in('visita_id', idsVisita)
        setReposicoes(repData || [])
      } else {
        setReposicoes([])
      }
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

  // Retorna quantos dias fazem desde a última visita (null se nunca foi visitado)
  function diasSemVisita(clienteId) {
    const ultima = ultimaVisitaPorCliente[clienteId]
    if (!ultima || !ultima.data_visita) return null
    const dataVisita = new Date(ultima.data_visita + 'T00:00:00')
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const diffMs = hoje - dataVisita
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  async function corrigirLocalizacoesFaltantes() {
    const semLocalizacao = clientes.filter((c) => !c.latitude || !c.longitude)
    if (semLocalizacao.length === 0) return

    setCorrigindoLocalizacao(true)
    setResumoLocalizacao(null)
    setProgressoLocalizacao([])
    setErro('')

    let ok = 0
    let semCep = 0
    let naoEncontrado = 0
    const lista = []

    for (const c of semLocalizacao) {
      const cepDigitos = (c.cep || '').replace(/\D/g, '')
      if (cepDigitos.length !== 8) {
        semCep++
        lista.push({ nome: c.nome, status: 'erro', mensagem: 'CEP inválido ou vazio' })
        setProgressoLocalizacao([...lista])
        continue
      }

      const r = await buscarEnderecoEGeo(cepDigitos)
      if (r.latitude && r.longitude) {
        try {
          const { error } = await supabase
            .from('carteira_clientes')
            .update({ latitude: r.latitude, longitude: r.longitude })
            .eq('id', c.id)
          if (error) throw error
          ok++
          lista.push({ nome: c.nome, status: 'ok', mensagem: 'Localização encontrada' })
        } catch (err) {
          lista.push({ nome: c.nome, status: 'erro', mensagem: err.message })
        }
      } else {
        naoEncontrado++
        lista.push({ nome: c.nome, status: 'pulado', mensagem: 'Não achou coordenadas para esse CEP' })
      }
      setProgressoLocalizacao([...lista])

      // Respeita o limite do serviço gratuito de geolocalização (1 busca por segundo)
      await new Promise((res) => setTimeout(res, 1100))
    }

    setResumoLocalizacao({ total: semLocalizacao.length, ok, semCep, naoEncontrado })
    await carregarTudo()
    setCorrigindoLocalizacao(false)
  }

  async function processarImportacao(file) {
    setImportando(true)
    setResumoImport(null)
    setProgressoImport([])
    setErro('')
    try {
      const buffer = await file.arrayBuffer()
      const registros = lerPlanilhaClientes(buffer)
      if (registros.length === 0) {
        setErro('Não encontrei nenhuma linha válida na planilha — confira se há uma coluna de Nome/Cliente e uma de CEP preenchidas.')
        return
      }

      const cnpjsExistentes = new Set(
        clientes.map((c) => (c.cnpj || '').replace(/\D/g, '')).filter(Boolean)
      )

      let ok = 0
      let erros = 0
      let pulados = 0
      const lista = []

      for (const reg of registros) {
        const cnpjDigitos = reg.cnpj.replace(/\D/g, '')
        if (cnpjDigitos && cnpjsExistentes.has(cnpjDigitos)) {
          pulados++
          lista.push({ nome: reg.nome, status: 'pulado', mensagem: 'CNPJ já está na sua carteira' })
          setProgressoImport([...lista])
          continue
        }

        let endereco = reg.endereco
        let bairro = reg.bairro
        let latitude = null
        let longitude = null

        const cepDigitos = reg.cep.replace(/\D/g, '')
        if (cepDigitos.length === 8) {
          const r = await buscarEnderecoEGeo(cepDigitos)
          if (r.encontrado) {
            endereco = endereco || r.endereco
            bairro = bairro || r.bairro
            latitude = r.latitude
            longitude = r.longitude
          }
        }

        try {
          const { error } = await supabase.from('carteira_clientes').insert([{
            nome: reg.nome,
            cnpj: reg.cnpj,
            cep: reg.cep,
            endereco,
            bairro,
            situacao: 'Ativo',
            latitude,
            longitude,
            vendedor_id: vendedor.id,
          }])
          if (error) throw error
          ok++
          if (cnpjDigitos) cnpjsExistentes.add(cnpjDigitos)
          lista.push({
            nome: reg.nome, status: 'ok',
            mensagem: latitude ? 'Cadastrado, com localização no mapa' : 'Cadastrado (sem localização — confira o CEP depois)',
          })
        } catch (err) {
          erros++
          lista.push({ nome: reg.nome, status: 'erro', mensagem: err.message })
        }
        setProgressoImport([...lista])

        // Respeita o limite do servico gratuito de geolocalizacao (1 busca por segundo)
        await new Promise((r) => setTimeout(r, 1100))
      }

      setResumoImport({ total: registros.length, ok, erros, pulados })
      await carregarTudo()
    } catch (err) {
      setErro('Não consegui ler essa planilha: ' + err.message)
    } finally {
      setImportando(false)
      if (inputArquivoRef.current) inputArquivoRef.current.value = ''
    }
  }

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

  async function salvarPerfil(e) {
    e.preventDefault()
    setSalvandoPerfil(true)
    setErro('')
    setPerfilSalvo(false)
    try {
      const { data, error } = await supabase
        .from('carteira_vendedores')
        .update(perfilForm)
        .eq('id', vendedor.id)
        .select()
        .single()
      if (error) throw error
      setVendedor(data)
      setPerfilSalvo(true)
    } catch (err) {
      setErro('Não consegui salvar seu perfil: ' + err.message)
    } finally {
      setSalvandoPerfil(false)
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
    setFormVisita({
      status: 'Visitado',
      data: new Date().toISOString().slice(0, 10),
      observacao: '',
      teve_reposicao: false,
      reposicao: { 'Verniz de Motor': '', 'Limpa Freio': '', 'Sanitizante': '' },
    })
  }

  async function salvarVisita(e) {
    e.preventDefault()
    if (!modalVisita) return
    setSalvandoVisita(true); setErro('')
    try {
      const { data: visita, error } = await supabase
        .from('carteira_visitas')
        .insert([{
          cliente_id: modalVisita.clienteId,
          data_visita: formVisita.data,
          status: formVisita.status,
          observacao: formVisita.observacao,
        }])
        .select()
        .single()
      if (error) throw error

      // Salva reposicoes (so os produtos com quantidade preenchida)
      if (formVisita.teve_reposicao && visita) {
        const linhas = PRODUTOS
          .filter((p) => formVisita.reposicao[p] && parseFloat(formVisita.reposicao[p]) > 0)
          .map((p) => ({
            visita_id: visita.id,
            produto: p,
            quantidade_litros: parseFloat(formVisita.reposicao[p]),
          }))
        if (linhas.length > 0) {
          const { error: e2 } = await supabase.from('carteira_reposicoes').insert(linhas)
          if (e2) throw e2
        }
      }

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

  // Reposicoes dentro do periodo filtrado (junta pela visita, que ja tem a data)
  const reposicoesFiltradas = useMemo(() => {
    const idsVisitasNoPeriodo = new Set(visitasFiltradas.map((v) => v.id))
    return reposicoes.filter((r) => idsVisitasNoPeriodo.has(r.visita_id))
  }, [reposicoes, visitasFiltradas])

  // Agrega uma lista de reposicoes em { porProduto, porCliente } - reutilizada
  // tanto para o total geral quanto para cada mes separado.
  function agregarReposicoes(lista) {
    const porClienteMapa = {}
    const porProdutoMapa = {}
    const detalhes = []
    for (const r of lista) {
      const visita = visitas.find((v) => v.id === r.visita_id)
      if (!visita) continue
      const clienteId = visita.cliente_id
      if (!porClienteMapa[clienteId]) {
        porClienteMapa[clienteId] = { nome: nomeCliente(clienteId), produtos: {}, datas: new Set() }
      }
      porClienteMapa[clienteId].produtos[r.produto] = (porClienteMapa[clienteId].produtos[r.produto] || 0) + Number(r.quantidade_litros)
      porClienteMapa[clienteId].datas.add(visita.data_visita)
      porProdutoMapa[r.produto] = (porProdutoMapa[r.produto] || 0) + Number(r.quantidade_litros)
      detalhes.push({
        data: visita.data_visita,
        nomeCliente: nomeCliente(clienteId),
        produto: r.produto,
        litros: Number(r.quantidade_litros),
      })
    }
    detalhes.sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    const porCliente = Object.values(porClienteMapa)
      .map((c) => ({ ...c, datas: Array.from(c.datas).sort().reverse() }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
    return {
      porCliente,
      porProduto: PRODUTOS.map((p) => ({ produto: p, total: porProdutoMapa[p] || 0 })),
      detalhes,
    }
  }

  const reposicaoAgregada = useMemo(
    () => agregarReposicoes(reposicoesFiltradas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reposicoesFiltradas, visitas, clientes]
  )
  const reposicaoPorCliente = reposicaoAgregada.porCliente
  const reposicaoPorProduto = reposicaoAgregada.porProduto

  // Quando nenhum mes especifico esta selecionado, quebra tudo em secoes por
  // mes (mais recente primeiro) - para o usuario ver a evolucao mes a mes.
  const reposicoesPorMes = useMemo(() => {
    if (filtroMes) return null // ja esta filtrado num mes so, nao precisa quebrar
    const porMes = {}
    for (const r of reposicoes) {
      const visita = visitas.find((v) => v.id === r.visita_id)
      if (!visita) continue
      const mes = (visita.data_visita || '').slice(0, 7) // "YYYY-MM"
      if (!mes) continue
      if (!porMes[mes]) porMes[mes] = []
      porMes[mes].push(r)
    }
    const meses = Object.keys(porMes).sort().reverse() // mais recente primeiro
    return meses.map((mes) => ({ mes, ...agregarReposicoes(porMes[mes]) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reposicoes, visitas, clientes, filtroMes])

  function nomeMes(mesStr) {
    const [ano, mes] = mesStr.split('-')
    const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    return `${nomes[parseInt(mes, 10) - 1]} de ${ano}`
  }

  function renderDiaCard(d, { comBorda = true } = {}) {
    const lc = LINHA_DIA[d]
    const lista = clientesPorDia.map[d]
    const comCoord = lista.filter((c) => c.latitude && c.longitude)
    const casaBase = (vendedor?.latitude_residencial && vendedor?.longitude_residencial)
      ? { lat: vendedor.latitude_residencial, lng: vendedor.longitude_residencial }
      : CASA_BASE_PADRAO
    const ordenados = ordenarPorProximidade(comCoord, casaBase)
    const linkRota = linkGoogleMaps(ordenados, casaBase)
    const mapaAberto = diaComMapaAberto === d
    const semCoord = lista.filter((c) => !(c.latitude && c.longitude))
    const listaExibicao = [...ordenados, ...semCoord]

    return (
      <div key={d} style={{ padding: '0 10px', borderLeft: comBorda ? '1px solid rgba(212,175,55,0.14)' : 'none', minWidth: 0 }}>
        <div style={{ marginBottom: 14 }}>
          <div className="av-serif" style={{ fontSize: 17, fontWeight: 700, color: '#F5F1E8' }}>
            {d}
          </div>
          <div style={{ fontSize: 11.5, color: '#9A9488', marginTop: 3 }}>
            {lista.length} {lista.length === 1 ? 'parada' : 'paradas'}
            {comCoord.length > 0 && comCoord.length < lista.length && <> · {comCoord.length} no mapa</>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setDiaComMapaAberto(mapaAberto ? null : d)}
              style={{
                border: `1px solid ${PREM.glassBorder}`, background: 'rgba(255,255,255,0.05)',
                borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 11.5,
                fontWeight: 600, color: '#D9D2C0',
              }}
            >
              {mapaAberto ? 'Ocultar mapa' : 'Ver mapa do dia'}
            </button>
            {linkRota && (
              <a
                href={linkRota} target="_blank" rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  border: `1px solid ${PREM.gold}`, background: 'rgba(212,175,55,0.10)',
                  borderRadius: 8, padding: '7px 12px', fontSize: 11.5, fontWeight: 700,
                  color: PREM.goldSoft, textDecoration: 'none',
                }}
              >
                📍 Abrir rota no Google Maps
              </a>
            )}
          </div>
        </div>

        {mapaAberto && (
          <div style={{ marginBottom: 16 }}>
            <MapaDia pontos={ordenados} cor={lc.cor} />
          </div>
        )}

        {listaExibicao.map((c) => {
          const st = STATUS_INFO[statusDoCliente(c.id)]
          const ultima = ultimaVisitaPorCliente[c.id]
          const repsUltima = ultima ? reposicoes.filter((r) => r.visita_id === ultima.id) : []
          const dias = diasSemVisita(c.id)
          const atrasado = (c.situacao || 'Ativo') === 'Ativo' && dias !== null && dias >= 14
          const nuncaVisitado = (c.situacao || 'Ativo') === 'Ativo' && dias === null
          return (
            <div key={c.id} style={{
              background: PREM.glass, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              border: atrasado ? '1px solid rgba(212,90,90,0.45)' : `1px solid ${PREM.glassBorder}`,
              borderRadius: 14, padding: '14px 16px', marginBottom: 12,
              boxShadow: '0 10px 24px -16px rgba(0,0,0,0.45)',
            }}>
              {atrasado && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 8,
                  background: 'rgba(212,90,90,0.15)', color: '#E39B9B', fontSize: 10.5, fontWeight: 700,
                  letterSpacing: '0.03em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999,
                }}>
                  ⚠ {dias} dias sem visita
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#F5F1E8', lineHeight: 1.3 }}>{c.nome}</div>
                  <div style={{ fontSize: 11.5, color: '#9A9488', marginTop: 3 }}>{c.bairro}</div>
                </div>
                <button
                  onClick={() => abrirModalVisita(c)}
                  style={{
                    background: PREM.gold, color: PREM.goldOn, border: 'none', borderRadius: 8,
                    padding: '7px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  Visitar →
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <Etiqueta texto={c.status_rodizio} info={RODIZIO_INFO} />
                <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.12)' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: st.cor, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{st.label}</span>
                {(c.situacao || 'Ativo') !== 'Ativo' && (
                  <>
                    <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.12)' }} />
                    <Etiqueta texto={c.situacao} info={SITUACAO_INFO} />
                  </>
                )}
                {nuncaVisitado && (
                  <>
                    <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.12)' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#E3B95F', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Nunca visitado
                    </span>
                  </>
                )}
              </div>

              <div style={{ marginTop: 8, fontSize: 11.5, color: '#9A9488' }}>
                mover p/ <SeletorDia cliente={c} onChange={alterarDia} />
              </div>

              {ultima && (
                <div style={{
                  marginTop: 10, padding: '9px 11px', background: 'rgba(0,0,0,0.22)', borderRadius: 8,
                  fontSize: 11.5, color: '#B5AF9F', borderLeft: `2px solid ${PREM.gold}`,
                }}>
                  <span className="av-mono">{ultima.data_visita}</span>
                  {ultima.observacao && <> · {ultima.observacao}</>}
                  {repsUltima.length > 0 && (
                    <div style={{ marginTop: 4, color: PREM.goldSoft, fontWeight: 600 }}>
                      {repsUltima.map((r) => `${r.produto}: ${r.quantidade_litros}L`).join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {lista.length === 0 && (
          <p style={{ color: '#9A9488', fontSize: 12.5 }}>Sem paradas.</p>
        )}
      </div>
    )
  }

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
      <div className="av-root" style={{ color: COR.textPrimary }}>
        <FontLoader />
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #14171F 0%, #1C1A14 55%, #3A2E0F 130%)', padding: 20,
        }}>
          <div style={{ width: 360 }}>
            <div style={{ marginBottom: 28, textAlign: 'center' }}>
              <div style={{ color: PREM.gold, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                LimpAr Auto
              </div>
              <div className="av-serif" style={{ color: '#F5F1E8', fontSize: 26, fontWeight: 700, marginTop: 6 }}>
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
    ['hoje', 'Roteiro do Dia'],
    ['roteiro', 'Roteiro semanal'],
    ['clientes', 'Clientes'],
    ['historico', 'Histórico'],
    ['reposicoes', 'Reposições'],
    ['painel', 'Painel'],
    ['perfil', 'Meu Perfil'],
    ...(vendedor?.admin ? [['vendedores', 'Vendedores']] : []),
  ]

  return (
    <div className="av-root" style={{ minHeight: '100vh', background: PREM.bgPage, color: COR.textPrimary }}>
      <FontLoader />

      <header style={{
        background: 'linear-gradient(135deg, #14171F 0%, #1C1A14 55%, #3A2E0F 130%)',
        padding: '32px 28px 40px', borderRadius: '0 0 24px 24px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%',
          background: `radial-gradient(circle, ${PREM.gold}4D, transparent 70%)`, pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, position: 'relative' }}>
          <div>
            <div style={{ color: PREM.gold, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              LimpAr Auto · Base SP
            </div>
            <div className="av-serif" style={{ color: '#F5F1E8', fontSize: 28, fontWeight: 700, marginTop: 6 }}>
              Carteira de Visitas
            </div>
          </div>
          <div className="av-mono" style={{ color: '#B5AF9F', fontSize: 12, textAlign: 'right' }}>
            <div style={{ color: '#F5F1E8', fontWeight: 700, marginBottom: 4 }}>
              {vendedor?.nome}
              <button onClick={sair} style={{
                marginLeft: 12, border: 'none', background: 'none', color: PREM.goldSoft,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>sair</button>
            </div>
            <div>{totalVisitado} visitados · {totalPendente} pendentes</div>
            <div>{clientes.length} clientes na carteira</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 26, position: 'relative' }}>
          {abas.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              style={{
                border: aba === key ? `1px solid ${PREM.gold}` : '1px solid rgba(212,175,55,0.18)',
                cursor: 'pointer', borderRadius: 999, padding: '9px 16px', whiteSpace: 'nowrap',
                fontSize: 13, fontWeight: aba === key ? 700 : 600,
                background: aba === key ? PREM.gold : 'rgba(255,255,255,0.06)',
                color: aba === key ? PREM.goldOn : '#D9D2C0',
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
        {carregando && <p style={{ color: '#B5AF9F' }}>Carregando carteira…</p>}

        {!carregando && aba === 'hoje' && (() => {
          const diaHoje = diaSemanaHoje()
          if (!diaHoje) {
            return (
              <Painel>
                <p style={{ margin: 0, color: COR.textSecondary, fontSize: 14 }}>
                  Hoje é fim de semana — sem rota cadastrada. Use a aba <strong>Roteiro semanal</strong> para ver os outros dias.
                </p>
              </Painel>
            )
          }
          return (
            <div style={{ maxWidth: 460 }}>
              <div style={{
                display: 'inline-block', marginBottom: 4, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.06em', color: PREM.goldSoft, textTransform: 'uppercase',
              }}>
                Roteiro do Dia
              </div>
              {renderDiaCard(diaHoje, { comBorda: false })}
            </div>
          )
        })()}

        {!carregando && aba === 'roteiro' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#B5AF9F', cursor: 'pointer' }}>
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
              {DIAS.map((d, idx) => renderDiaCard(d, { comBorda: idx !== 0 }))}
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
              <div className="av-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                Importar planilha
              </div>
              <p style={{ fontSize: 12.5, color: COR.textSecondary, marginTop: 0, marginBottom: 14 }}>
                Aceita .xlsx ou .xls. A planilha precisa de uma coluna de nome do cliente e uma de CEP
                (os nomes das colunas podem variar — ex: "Cliente" ou "Nome", "Cep" ou "CEP"). Colunas de
                CNPJ, Endereço e Bairro são opcionais.
              </p>
              <input
                ref={inputArquivoRef}
                type="file"
                accept=".xlsx,.xls"
                disabled={importando}
                onChange={(e) => { if (e.target.files?.[0]) processarImportacao(e.target.files[0]) }}
                style={{ fontSize: 13 }}
              />

              {importando && (
                <p style={{ fontSize: 12.5, color: COR.amberDeep, marginTop: 12 }}>
                  Importando… isso demora cerca de 1 segundo por cliente (respeitando o limite do serviço
                  de busca de endereço). Não feche esta aba.
                </p>
              )}

              {progressoImport.length > 0 && (
                <div className="av-scroll" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 14, border: `1px solid ${COR.lineSoft}`, borderRadius: 4 }}>
                  {progressoImport.map((p, i) => {
                    const cor = p.status === 'ok' ? '#3F6B4D' : p.status === 'pulado' ? '#B6862F' : '#8C3F4F'
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px',
                        borderBottom: i < progressoImport.length - 1 ? `1px solid ${COR.lineSoft}` : 'none',
                        fontSize: 12.5,
                      }}>
                        <span style={{ fontWeight: 600 }}>{p.nome || '(sem nome)'}</span>
                        <span style={{ color: cor, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.mensagem}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {resumoImport && (
                <p style={{ fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 0 }}>
                  {resumoImport.ok} cadastrados · {resumoImport.pulados} já existiam · {resumoImport.erros} com erro
                  {' '}(de {resumoImport.total} linhas na planilha).
                </p>
              )}
            </Painel>

            {(() => {
              const semLocalizacao = clientes.filter((c) => !c.latitude || !c.longitude)
              if (semLocalizacao.length === 0) return null
              return (
                <Painel style={{ marginBottom: 20 }}>
                  <div className="av-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                    Corrigir localização de clientes antigos
                  </div>
                  <p style={{ fontSize: 12.5, color: COR.textSecondary, marginTop: 0, marginBottom: 14 }}>
                    {semLocalizacao.length} {semLocalizacao.length === 1 ? 'cliente ainda não tem' : 'clientes ainda não têm'} localização
                    salva (cadastrados antes da busca automática existir) — por isso não aparecem no mapa
                    nem contam pra rota do Google Maps. Clique abaixo pra buscar a localização de todos de uma vez.
                  </p>
                  <Botao variant="amber" onClick={corrigirLocalizacoesFaltantes} disabled={corrigindoLocalizacao}>
                    {corrigindoLocalizacao ? 'Buscando…' : `Buscar localização de ${semLocalizacao.length} clientes`}
                  </Botao>

                  {corrigindoLocalizacao && (
                    <p style={{ fontSize: 12.5, color: COR.amberDeep, marginTop: 12 }}>
                      Isso demora cerca de 1 segundo por cliente. Não feche esta aba.
                    </p>
                  )}

                  {progressoLocalizacao.length > 0 && (
                    <div className="av-scroll" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 14, border: `1px solid ${COR.lineSoft}`, borderRadius: 4 }}>
                      {progressoLocalizacao.map((p, i) => {
                        const cor = p.status === 'ok' ? '#3F6B4D' : p.status === 'pulado' ? '#B6862F' : '#8C3F4F'
                        return (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px',
                            borderBottom: i < progressoLocalizacao.length - 1 ? `1px solid ${COR.lineSoft}` : 'none',
                            fontSize: 12.5,
                          }}>
                            <span style={{ fontWeight: 600 }}>{p.nome || '(sem nome)'}</span>
                            <span style={{ color: cor, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.mensagem}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {resumoLocalizacao && (
                    <p style={{ fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 0 }}>
                      {resumoLocalizacao.ok} encontrados · {resumoLocalizacao.naoEncontrado} não encontrados · {resumoLocalizacao.semCep} sem CEP válido
                      {' '}(de {resumoLocalizacao.total}).
                    </p>
                  )}
                </Painel>
              )
            })()}

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
                  {['Data', 'Cliente', 'Status', 'Observação', 'Reposição'].map((h) => (
                    <th key={h} style={{
                      padding: '0 10px 10px 0', fontSize: 10.5, fontWeight: 700,
                      color: COR.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitasFiltradas.map((v) => {
                  const reps = reposicoes.filter((r) => r.visita_id === v.id)
                  return (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${COR.lineSoft}` }}>
                      <td className="av-mono" style={{ padding: '10px 10px 10px 0', color: COR.textSecondary }}>{v.data_visita}</td>
                      <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{nomeCliente(v.cliente_id)}</td>
                      <td style={{ padding: '10px 10px 10px 0' }}><Etiqueta texto={v.status} info={STATUS_INFO} /></td>
                      <td style={{ padding: '10px 10px 10px 0', color: COR.textSecondary }}>{v.observacao}</td>
                      <td style={{ padding: '10px 0' }}>
                        {reps.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {reps.map((r) => (
                              <span key={r.id} className="av-mono" style={{ fontSize: 11.5, color: COR.amberDeep }}>
                                {r.produto}: {r.quantidade_litros}L
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: COR.textSecondary, fontSize: 11.5 }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {visitasFiltradas.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '16px 0', textAlign: 'center', color: COR.textSecondary }}>
                    Nenhuma visita registrada {filtroMes ? 'neste mês' : 'ainda'}.
                  </td></tr>
                )}
              </tbody>
            </table>
          </Painel>
        )}

        {!carregando && aba === 'reposicoes' && (() => {
          const BlocoReposicao = ({ porProduto, porCliente, detalhes, tituloSufixo }) => (
            <>
              <Painel style={{ marginBottom: 14 }}>
                <div className="av-display" style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>
                  Total por produto {tituloSufixo}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, background: COR.line }}>
                  {porProduto.map((p) => (
                    <div key={p.produto} style={{ background: COR.paperRaised, padding: '14px 16px' }}>
                      <div className="av-mono" style={{ fontSize: 22, fontWeight: 500, color: COR.amberDeep }}>
                        {p.total}L
                      </div>
                      <div style={{ fontSize: 11.5, color: COR.textSecondary, marginTop: 4 }}>{p.produto}</div>
                    </div>
                  ))}
                </div>
              </Painel>

              <Painel style={{ marginBottom: 14 }}>
                <div className="av-display" style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>
                  Total por cliente {tituloSufixo}
                </div>
                {porCliente.length === 0 ? (
                  <p style={{ color: COR.textSecondary, fontSize: 13, padding: '8px 0' }}>
                    Nenhuma reposição registrada.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: `1px solid ${COR.line}` }}>
                        <th style={{ padding: '0 10px 10px 0', fontSize: 10.5, fontWeight: 700, color: COR.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          Cliente
                        </th>
                        {PRODUTOS.map((p) => (
                          <th key={p} style={{ padding: '0 10px 10px 0', fontSize: 10.5, fontWeight: 700, color: COR.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'right' }}>
                            {p}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porCliente.map((c) => (
                        <tr key={c.nome} style={{ borderBottom: `1px solid ${COR.lineSoft}` }}>
                          <td style={{ padding: '10px 10px 10px 0' }}>
                            <div style={{ fontWeight: 600 }}>{c.nome}</div>
                            <div className="av-mono" style={{ fontSize: 11, color: COR.textSecondary, marginTop: 2 }}>
                              {c.datas.join(' · ')}
                            </div>
                          </td>
                          {PRODUTOS.map((p) => (
                            <td key={p} className="av-mono" style={{ padding: '10px 10px 10px 0', textAlign: 'right', color: c.produtos[p] ? COR.textPrimary : COR.textSecondary }}>
                              {c.produtos[p] ? `${c.produtos[p]}L` : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Painel>

              <Painel style={{ marginBottom: 24 }}>
                <div className="av-display" style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>
                  Detalhamento por dia {tituloSufixo}
                </div>
                {detalhes.length === 0 ? (
                  <p style={{ color: COR.textSecondary, fontSize: 13, padding: '8px 0' }}>
                    Nenhuma reposição registrada.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: `1px solid ${COR.line}` }}>
                        {['Data', 'Cliente', 'Produto', 'Litros'].map((h) => (
                          <th key={h} style={{
                            padding: '0 10px 10px 0', fontSize: 10.5, fontWeight: 700,
                            color: COR.textSecondary, letterSpacing: '0.04em', textTransform: 'uppercase',
                            textAlign: h === 'Litros' ? 'right' : 'left',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detalhes.map((d, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${COR.lineSoft}` }}>
                          <td className="av-mono" style={{ padding: '8px 10px 8px 0', color: COR.textSecondary }}>{d.data}</td>
                          <td style={{ padding: '8px 10px 8px 0', fontWeight: 600 }}>{d.nomeCliente}</td>
                          <td style={{ padding: '8px 10px 8px 0', color: COR.textSecondary }}>{d.produto}</td>
                          <td className="av-mono" style={{ padding: '8px 0', textAlign: 'right', color: COR.amberDeep, fontWeight: 600 }}>{d.litros}L</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Painel>
            </>
          )

          return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                <div className="av-display" style={{ fontSize: 15, fontWeight: 700 }}>Reposição de produto</div>
                <input
                  type="month"
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                  style={{ padding: 8, borderRadius: 4, border: `1px solid ${COR.line}`, fontSize: 13 }}
                />
                {filtroMes && (
                  <button onClick={() => setFiltroMes('')} style={{
                    border: 'none', background: 'none', color: COR.textSecondary, cursor: 'pointer', fontSize: 12.5,
                  }}>ver todos os meses separados</button>
                )}
              </div>

              {filtroMes ? (
                <BlocoReposicao
                  porProduto={reposicaoAgregada.porProduto}
                  porCliente={reposicaoAgregada.porCliente}
                  detalhes={reposicaoAgregada.detalhes}
                  tituloSufixo=""
                />
              ) : reposicoesPorMes.length === 0 ? (
                <Painel>
                  <p style={{ color: COR.textSecondary, fontSize: 13, margin: 0 }}>
                    Nenhuma reposição registrada ainda.
                  </p>
                </Painel>
              ) : (
                reposicoesPorMes.map(({ mes, porProduto, porCliente, detalhes }) => (
                  <div key={mes} style={{ marginBottom: 8 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                      color: COR.amberDeep, marginBottom: 10, borderBottom: `2px solid ${COR.amber}`, paddingBottom: 6,
                    }}>
                      {nomeMes(mes)}
                    </div>
                    <BlocoReposicao porProduto={porProduto} porCliente={porCliente} detalhes={detalhes} tituloSufixo="" />
                  </div>
                ))
              )}
            </>
          )
        })()}

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

        {aba === 'perfil' && (
          <Painel style={{ maxWidth: 480 }}>
            <div className="av-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              Meu Perfil
            </div>
            <p style={{ fontSize: 12.5, color: COR.textSecondary, marginTop: 0, marginBottom: 16 }}>
              Seu endereço residencial é usado como ponto de partida nas rotas e no mapa.
              A placa define automaticamente o seu dia de rodízio em São Paulo.
            </p>

            <form onSubmit={salvarPerfil}>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Campo label="CEP residencial" placeholder="00000-000"
                  value={perfilForm.cep_residencial}
                  onChange={(e) => setPerfilForm({ ...perfilForm, cep_residencial: e.target.value })} />
                {buscandoCepPerfil && (
                  <span style={{ position: 'absolute', right: 10, bottom: 10, fontSize: 11, color: COR.textSecondary }}>
                    buscando…
                  </span>
                )}
              </div>

              {cepPerfilEncontrado === false && (
                <p style={{ fontSize: 11.5, color: '#B6862F', marginTop: -6, marginBottom: 12 }}>
                  CEP não encontrado — preencha o endereço manualmente.
                </p>
              )}
              {cepPerfilEncontrado === true && (
                <p style={{ fontSize: 11.5, color: perfilForm.latitude_residencial ? '#3F6B4D' : '#B6862F', marginTop: -6, marginBottom: 12 }}>
                  {perfilForm.latitude_residencial
                    ? '📍 Endereço e localização encontrados.'
                    : 'Endereço encontrado, mas sem localização exata no mapa.'}
                </p>
              )}

              <div style={{ marginBottom: 12 }}>
                <Campo label="Endereço" value={perfilForm.endereco_residencial}
                  onChange={(e) => setPerfilForm({ ...perfilForm, endereco_residencial: e.target.value })} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Campo label="Bairro" value={perfilForm.bairro_residencial}
                  onChange={(e) => setPerfilForm({ ...perfilForm, bairro_residencial: e.target.value })} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <Campo label="Placa do veículo" placeholder="ABC1D23" value={perfilForm.placa}
                  onChange={(e) => setPerfilForm({ ...perfilForm, placa: e.target.value })} />
              </div>

              {perfilForm.placa && (
                <p style={{ fontSize: 13, fontWeight: 600, color: COR.amberDeep, marginTop: 6, marginBottom: 16 }}>
                  {diaRodizioPorPlaca(perfilForm.placa)
                    ? `Seu dia de rodízio: ${diaRodizioPorPlaca(perfilForm.placa)}`
                    : 'Não consegui identificar o dia pelo final dessa placa — confira se digitou certo.'}
                </p>
              )}

              <Botao type="submit" variant="amber" disabled={salvandoPerfil}>
                {salvandoPerfil ? 'Salvando…' : 'Salvar meus dados'}
              </Botao>
              {perfilSalvo && (
                <span style={{ marginLeft: 12, fontSize: 12.5, color: '#3F6B4D', fontWeight: 600 }}>
                  Salvo!
                </span>
              )}
            </form>
          </Painel>
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
                    {['Nome', 'Usuário', 'Placa', 'Dia de Rodízio', 'Admin', 'Status', ''].map((h) => (
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
                      <td className="av-mono" style={{ padding: '10px 10px 10px 0', color: COR.textSecondary }}>{v.placa || '—'}</td>
                      <td style={{ padding: '10px 10px 10px 0' }}>{diaRodizioPorPlaca(v.placa) || '—'}</td>
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

              {/* Reposição de produto */}
              <div style={{ borderTop: `1px solid ${COR.lineSoft}`, paddingTop: 14, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={formVisita.teve_reposicao}
                    onChange={(e) => setFormVisita({ ...formVisita, teve_reposicao: e.target.checked })}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: COR.textPrimary }}>
                    Teve reposição de produto?
                  </span>
                </label>

                {formVisita.teve_reposicao && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {PRODUTOS.map((p) => (
                      <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                        <span style={{ flex: 1, color: COR.textSecondary, fontWeight: 500 }}>{p}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="0"
                            value={formVisita.reposicao[p]}
                            onChange={(e) => setFormVisita({
                              ...formVisita,
                              reposicao: { ...formVisita.reposicao, [p]: e.target.value }
                            })}
                            style={{
                              width: 72, padding: '7px 10px', borderRadius: 4,
                              border: `1px solid ${COR.line}`, fontSize: 14, textAlign: 'right',
                            }}
                          />
                          <span style={{ fontSize: 12, color: COR.textSecondary }}>L</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

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

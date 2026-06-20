import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const ClienteContext = createContext(null)

export function ClienteProvider({ children }) {
  const [cliente, setCliente] = useState(null)
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clientes').select('*').order('nome')
      setClientes(data || [])

      // Verifica se a URL já indica um cliente específico (ex: /skap-turbo)
      const path = window.location.pathname.replace('/', '').trim()
      if (path && data) {
        const found = data.find(c => c.slug === path)
        if (found) setCliente(found)
      }
      setLoading(false)
    })()
  }, [])

  const selecionarCliente = (c) => {
    setCliente(c)
    window.history.pushState({}, '', '/' + c.slug)
  }

  const sairDoCliente = () => {
    setCliente(null)
    window.history.pushState({}, '', '/')
  }

  return (
    <ClienteContext.Provider value={{ cliente, clientes, setClientes, loading, selecionarCliente, sairDoCliente }}>
      {children}
    </ClienteContext.Provider>
  )
}

export function useCliente() {
  return useContext(ClienteContext)
}
Concluído

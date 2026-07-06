import { useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function VendaModal({ vendedores, servicos, vendas, comissoes, editing, onClose, onSaved, notify, clienteId }) {
  const v = editing || {}
  const [form, setForm] = useState({
    data: v.data || todayStr(),
    cliente: v.cliente || '',
    placa: (v.placa || '').toUpperCase(),
    modelo: v.modelo || '',
    servico: v.servico || '',
    valor: v.valor || '',
    vendedor: v.vendedor || '',
    aplicador: v.aplicador || '',
    pgto: v.pgto || 'Dinheiro',
    status: v.status || 'Pendente',
    obs: v.obs || '',
  })
  const [saving, setSaving] = useState(false)

  const comissaoInfo = useMemo(() => {
    if (!form.vendedor || !vendas || !comissoes) return null
    const mes = todayStr().slice(0, 7)
    const comissaoVendedor = (comissoes.find(c => c.vendedor === form.vendedor) || {}).valor || 0
    const comissaoAplicador = form.aplicador ? (comissoes.find(c => c.vendedor === form.aplicador) || {}).valor || 0 : 0
    const qtdVendedor = vendas.filter(x => x.vendedor === form.vendedor && x.data.startsWith(mes) && x.status === 'Concluído').length
    const qtdAplicador = form.aplicador ? vendas.filter(x => x.aplicador === form.aplicador && x.data.startsWith(mes) && x.status === 'Concluído').length : 0
    return {
      vendedor: { nome: form.vendedor, qtd: qtdVendedor, fixo: comissaoVendedor, total: qtdVendedor * comissaoVendedor },
      aplicador: form.aplicador ? { nome: form.aplicador, qtd: qtdAplicador, fixo: comissaoAplicador, total: qtdAplicador * comissaoAplicador } : null,
    }
  }, [form.vendedor, form.aplicador, vendas, comissoes])

  const set = (k, val) => setForm(f => ({ ...f, [k]: val }))

  const onServicoChange = (nome) => {
    set('servico', nome)
    const s = servicos.find(x => x.nome === nome)
    if (s) set('valor', s.valor)
  }

  const handleSave = async () => {
    if (!form.cliente.trim() || !form.vendedor || !form.servico || !form.valor || Number(form.valor) <= 0) {
      notify('Preencha Cliente, Vendedor, Serviço e Valor.', 'error'); return
    }
    setSaving(true)
    try {
      const payload = {
        data: form.data, cliente: form.cliente.trim(), placa: form.placa, modelo: form.modelo,
        servico: form.servico, valor: Number(form.valor), vendedor: form.vendedor,
        aplicador: form.aplicador || '', pgto: form.pgto, status: form.status, obs: form.obs,
      }
      if (editing) {
        const { error } = await supabase.from('vendas').update(payload).eq('id', editing.id)
        if (error) throw error
        notify('TMO/Venda atualizada!')
      } else {
        const { data: maxRows } = await supabase.from('vendas').select('os_num').eq('cliente_id', clienteId).order('os_num', { ascending: false }).limit(1)
        const nextOs = maxRows && maxRows.length > 0 ? maxRows[0].os_num + 1 : 1
        const { error } = await supabase.from('vendas').insert({ ...payload, os_num: nextOs, cliente_id: clienteId })
        if (error) throw error
        notify('TMO/Venda registrada! OS #' + String(nextOs).padStart(4, '0'))
      }
      onSaved()
    } catch (err) {
      notify('Erro ao salvar: ' + err.message, 'error')
    }
    setSaving(false)
  }

  const vendedoresAtivos = vendedores.filter(x => x.status === 'Ativo')

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{editing ? 'Editar TMO/Venda' : 'Nova TMO/Venda / OS'}</div>
          <button className="btn btn-icon" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">

          {/* Destaque de comissão acumulada */}
          {comissaoInfo && (
            <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'rgba(56,189,248,0.8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Comissão acumulada no mês
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Vendedor — {comissaoInfo.vendedor.nome}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8' }}>R$ {fmt(comissaoInfo.vendedor.total)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{comissaoInfo.vendedor.qtd} TMO × R$ {fmt(comissaoInfo.vendedor.fixo)}</div>
                </div>
                {comissaoInfo.aplicador && (
                  <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Aplicador — {comissaoInfo.aplicador.nome}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#4ade80' }}>R$ {fmt(comissaoInfo.aplicador.total)}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{comissaoInfo.aplicador.qtd} TMO × R$ {fmt(comissaoInfo.aplicador.fixo)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Data</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {['Pendente', 'Concluído', 'Cancelado'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Vendedor / Atendente <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={form.vendedor} onChange={e => set('vendedor', e.target.value)}>
                <option value="">Selecione...</option>
                {vendedoresAtivos.map(x => <option key={x.id} value={x.nome}>{x.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Aplicador / Mecânico <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>(opcional)</span></label>
              <select value={form.aplicador} onChange={e => set('aplicador', e.target.value)}>
                <option value="">Nenhum</option>
                {vendedoresAtivos.map(x => <option key={x.id} value={x.nome}>{x.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Cliente Final</label>
            <input value={form.cliente} onChange={e => set('cliente', e.target.value)} placeholder="Nome do cliente final" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Placa do Veículo</label>
              <input value={form.placa} onChange={e => set('placa', e.target.value.toUpperCase())} placeholder="ABC-1234" />
            </div>
            <div className="form-group">
              <label>Modelo</label>
              <input value={form.modelo} onChange={e => set('modelo', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Serviço Realizado</label>
              <select value={form.servico} onChange={e => onServicoChange(e.target.value)}>
                <option value="">Selecione...</option>
                {servicos.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Valor (R$)</label>
              <input type="number" min="0" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Forma de Pagamento</label>
              <select value={form.pgto} onChange={e => set('pgto', e.target.value)}>
                {['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Transferência', 'Boleto'].map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Observações</label>
              <input value={form.obs} onChange={e => set('obs', e.target.value)} placeholder="Opcional" />
            </div>
          </div>

        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Salvando...' : 'Salvar TMO/Venda'}
          </button>
        </div>
      </div>
    </div>
  )
}

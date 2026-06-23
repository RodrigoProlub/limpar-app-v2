import { useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

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
    pgto: v.pgto || 'Dinheiro',
    status: v.status || 'Pendente',
    obs: v.obs || '',
  })
  const [saving, setSaving] = useState(false)

  const comissaoInfo = useMemo(() => {
    if (!form.vendedor || !vendas || !comissoes) return null
    const mes = todayStr().slice(0, 7)
    const comissaoFixa = (comissoes.find(c => c.vendedor === form.vendedor) || {}).valor || 0
    const qtd = vendas.filter(x => x.vendedor === form.vendedor && x.data.startsWith(mes) && x.status === 'Concluído').length
    return { qtd, comissaoFixa, total: qtd * comissaoFixa }
  }, [form.vendedor, vendas, comissoes])

  const set = (k, val) => setForm(f => ({ ...f, [k]: val }))

  const onPlacaChange = (val) => {
    set('placa', val.toUpperCase())
  }

  const onServicoChange = (nome) => {
    set('servico', nome)
    const s = servicos.find(x => x.nome === nome)
    if (s) set('valor', s.valor)
  }

  const handleSave = async () => {
    if (!form.cliente.trim() || !form.vendedor || !form.servico || !form.valor || Number(form.valor) <= 0) {
      notify('Preencha Cliente, Vendedor, Serviço e Valor.', 'error')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('vendas').update({
          data: form.data, cliente: form.cliente.trim(), placa: form.placa, modelo: form.modelo,
          servico: form.servico, valor: Number(form.valor), vendedor: form.vendedor,
          pgto: form.pgto, status: form.status, obs: form.obs,
        }).eq('id', editing.id)
        if (error) throw error
        notify('TMO/Venda atualizada!')
      } else {
        // get next OS number (scoped to this cliente)
        const { data: maxRows } = await supabase.from('vendas').select('os_num').eq('cliente_id', clienteId).order('os_num', { ascending: false }).limit(1)
        const nextOs = maxRows && maxRows.length > 0 ? maxRows[0].os_num + 1 : 1
        const { error } = await supabase.from('vendas').insert({
          os_num: nextOs, data: form.data, cliente: form.cliente.trim(), placa: form.placa, modelo: form.modelo,
          servico: form.servico, valor: Number(form.valor), vendedor: form.vendedor,
          pgto: form.pgto, status: form.status, obs: form.obs, cliente_id: clienteId,
        })
        if (error) throw error
        notify('TMO/Venda registrada! OS #' + String(nextOs).padStart(4, '0'))
      }
      onSaved()
    } catch (err) {
      notify('Erro ao salvar: ' + err.message, 'error')
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{editing ? 'Editar TMO/Venda' : 'Nova TMO/Venda / OS'}</div>
          <button className="btn btn-icon" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          {comissaoInfo && (
            <div style={{
              background: '#fee2e2', border: '2px solid #dc2626', borderRadius: 10,
              padding: '12px 16px', marginBottom: 16, textAlign: 'center'
            }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Comissão acumulada no mês — {form.vendedor}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#dc2626', lineHeight: 1.3 }}>
                R$ {fmt(comissaoInfo.total)}
              </div>
              <div style={{ fontSize: 12, color: '#dc2626' }}>
                {comissaoInfo.qtd} TMO/venda(s) concluída(s) × R$ {fmt(comissaoInfo.comissaoFixa)}
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Data</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Vendedor Responsável</label>
              <select value={form.vendedor} onChange={e => set('vendedor', e.target.value)}>
                <option value="">Selecione...</option>
                {vendedores.filter(x => x.status === 'Ativo').map(x => (
                  <option key={x.id} value={x.nome}>{x.nome}</option>
                ))}
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
              <input value={form.placa} onChange={e => onPlacaChange(e.target.value)} placeholder="ABC-1234" />
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
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {['Pendente', 'Concluído', 'Cancelado'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Observações</label>
            <textarea rows={2} value={form.obs} onChange={e => set('obs', e.target.value)} />
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

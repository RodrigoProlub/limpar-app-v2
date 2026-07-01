import { useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import SimpleModal from '../components/SimpleModal'
import ConfirmDialog from '../components/ConfirmDialog'

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function mesLabel(mes) {
  if (!mes) return '—'
  const [ano, m] = mes.split('-')
  return MESES[Number(m) - 1] + '/' + ano
}

export default function Comissoes({ comissoes, vendedores, vendas, fechamentos, onChanged, notify, clienteId }) {
  const [modal, setModal] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [confirmFechar, setConfirmFechar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fechando, setFechando] = useState(false)

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual)

  // gera lista de meses disponíveis: meses que têm vendas + mês atual
  const mesesDisponiveis = useMemo(() => {
    const set = new Set([mesAtual])
    vendas.forEach(v => { if (v.data) set.add(v.data.slice(0, 7)) })
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [vendas, mesAtual])

  const resumoMes = useMemo(() => {
    return vendedores.map(v => {
      const comissaoFixa = (comissoes.find(c => c.vendedor === v.nome) || {}).valor || 0
      const qtd = vendas.filter(x => x.vendedor === v.nome && x.data.startsWith(mesSelecionado) && x.status === 'Concluído').length
      const jaFechado = fechamentos.some(f => f.vendedor === v.nome && f.mes === mesSelecionado)
      return { nome: v.nome, qtd, comissaoFixa, total: qtd * comissaoFixa, jaFechado }
    }).filter(r => r.qtd > 0 || r.jaFechado)
  }, [vendedores, vendas, comissoes, fechamentos, mesSelecionado])

  const pendentes = resumoMes.filter(r => !r.jaFechado && r.qtd > 0)

  const handleFechar = async () => {
    if (pendentes.length === 0) { notify('Nada pendente para fechar este mês.', 'warning'); setConfirmFechar(false); return }
    setFechando(true)
    const rows = pendentes.map(r => ({
      cliente_id: clienteId, vendedor: r.nome, mes: mesSelecionado,
      qtd_tmo: r.qtd, valor_unitario: r.comissaoFixa, total: r.total,
    }))
    const { error } = await supabase.from('fechamentos_comissao').insert(rows)
    setFechando(false)
    setConfirmFechar(false)
    if (error) notify('Erro ao fechar: ' + error.message, 'error')
    else { notify('Comissão de ' + mesLabel(mesSelecionado) + ' fechada!'); onChanged() }
  }

  const handleSave = async (form) => {
    if (!form.vendedor || !form.valor) { notify('Preencha todos os campos.', 'error'); return }
    setSaving(true)
    const payload = { vendedor: form.vendedor, valor: Number(form.valor), cliente_id: clienteId }
    let error
    if (modal.editing) {
      ({ error } = await supabase.from('comissoes').update(payload).eq('id', modal.editing.id))
    } else {
      await supabase.from('comissoes').delete().eq('vendedor', form.vendedor).eq('cliente_id', clienteId)
      ;({ error } = await supabase.from('comissoes').insert(payload))
    }
    setSaving(false)
    if (error) notify('Erro: ' + error.message, 'error')
    else { notify('Comissão salva!'); setModal(null); onChanged() }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('comissoes').delete().eq('id', id)
    if (error) notify('Erro ao excluir: ' + error.message, 'error')
    else { notify('Comissão excluída.', 'warning'); onChanged() }
    setConfirmId(null)
  }

  const historico = useMemo(() => {
    return [...fechamentos].sort((a, b) => (b.mes + b.vendedor).localeCompare(a.mes + a.vendedor))
  }, [fechamentos])

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Fechamento de Comissão</div>
            <select
              value={mesSelecionado}
              onChange={e => setMesSelecionado(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
            >
              {mesesDisponiveis.map(m => (
                <option key={m} value={m}>{mesLabel(m)}{m === mesAtual ? ' (mês atual)' : ''}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-danger" onClick={() => setConfirmFechar(true)} disabled={pendentes.length === 0}>
            <i className="fas fa-lock"></i> Fechar Comissão do Mês
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Vendedor</th><th>TMO/Venda Concluído</th><th>Valor por TMO</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {resumoMes.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>Nenhum TMO/Venda concluído este mês ainda.</td></tr>
              ) : resumoMes.map(r => (
                <tr key={r.nome}>
                  <td><b>{r.nome}</b></td>
                  <td>{r.qtd}</td>
                  <td>R$ {fmt(r.comissaoFixa)}</td>
                  <td><b style={{ color: '#dc2626' }}>R$ {fmt(r.total)}</b></td>
                  <td>{r.jaFechado
                    ? <span className="badge badge-success">Fechado</span>
                    : <span className="badge badge-warning">Pendente</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Histórico de Fechamentos</div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Mês</th><th>Vendedor</th><th>TMO/Venda</th><th>Valor por TMO</th><th>Total Pago</th></tr></thead>
            <tbody>
              {historico.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>Nenhum fechamento registrado ainda.</td></tr>
              ) : historico.map(f => (
                <tr key={f.id}>
                  <td>{mesLabel(f.mes)}</td>
                  <td>{f.vendedor}</td>
                  <td>{f.qtd_tmo}</td>
                  <td>R$ {fmt(f.valor_unitario)}</td>
                  <td><b>R$ {fmt(f.total)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b' }}>Configurar Valor por TMO/Venda</div>
        <button className="btn btn-primary" onClick={() => setModal({ editing: null })}><i className="fas fa-plus"></i> Definir Comissão</button>
      </div>
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Vendedor</th><th>Comissão por TMO/Venda (R$)</th><th>Ações</th></tr></thead>
            <tbody>
              {comissoes.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Nenhuma comissão configurada.</td></tr>
              ) : comissoes.map(c => (
                <tr key={c.id}>
                  <td>{c.vendedor}</td>
                  <td><b>R$ {fmt(c.valor)}</b> <span style={{ color: '#94a3b8', fontSize: 11 }}>/ TMO</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-icon btn-sm" onClick={() => setModal({ editing: c })}><i className="fas fa-edit"></i></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmId(c.id)}><i className="fas fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <SimpleModal
          title={modal.editing ? 'Editar Comissão' : 'Definir Comissão'}
          fields={[
            { key: 'vendedor', label: 'Vendedor', type: 'select', options: vendedores.map(v => v.nome) },
            { key: 'valor', label: 'Valor Fixo por TMO/Venda (R$)', type: 'number' },
          ]}
          values={modal.editing || {}}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {confirmId && (
        <ConfirmDialog message="Excluir esta comissão?" onCancel={() => setConfirmId(null)} onConfirm={() => handleDelete(confirmId)} />
      )}

      {confirmFechar && (
        <ConfirmDialog
          message={'Fechar a comissão de ' + mesLabel(mesSelecionado) + '? Isso vai registrar o pagamento de ' + pendentes.length + ' vendedor(es) e não poderá ser desfeito automaticamente.'}
          onCancel={() => setConfirmFechar(false)}
          onConfirm={handleFechar}
        />
      )}
    </div>
  )
}

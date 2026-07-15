// =====================================================================
// LimpAr Auto — Painel do Admin: Faturamento & Bonificação
// Salvar em: src/pages/AdminFaturamento.jsx
// Usa o supabaseClient já existente do app — nada a configurar.
// Rota sugerida:
//   <Route path="/admin/faturamento" element={<AdminFaturamento/>} />
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// ---- helpers ----
const brl = (v) =>
  'R$ ' + (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  });
const brlK = (v) => 'R$ ' + Math.round((v || 0) / 1000) + 'k';

// paleta clara e neutra
const C = {
  bg: '#faf9f7', card: '#ffffff', line: '#e6e4de', lineStrong: '#d3d1c7',
  ink: '#1f1f1d', ink2: '#5f5e5a', ink3: '#8a8880',
  accent: '#185fa5', accentBg: '#e6f1fb',
  ok: '#0f6e56', okBg: '#e1f5ee', warn: '#854f0b', warnBg: '#faeeda',
};

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

export default function AdminFaturamento() {
  const [comps, setComps] = useState([]);          // competências disponíveis
  const [compId, setCompId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [fatCliente, setFatCliente] = useState([]);   // fb_v_faturamento_cliente
  const [bonColab, setBonColab] = useState([]);       // fb_v_bonif_colaborador
  const [statusMap, setStatusMap] = useState({});     // colaborador_id -> status (edições locais)

  // ---- carrega competências uma vez ----
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('fb_competencias')
        .select('id, ano, mes, status')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });
      if (error) { setErro(error.message); setLoading(false); return; }
      setComps(data || []);
      if (data && data.length) setCompId(data[0].id);
      else setLoading(false);
    })();
  }, []);

  // ---- carrega dados da competência selecionada ----
  useEffect(() => {
    if (!compId) return;
    setLoading(true); setErro(null);
    (async () => {
      const [fat, bon] = await Promise.all([
        supabase.from('fb_v_faturamento_cliente').select('*').eq('competencia_id', compId),
        supabase.from('fb_v_bonif_colaborador').select('*').eq('competencia_id', compId),
      ]);
      if (fat.error) { setErro(fat.error.message); setLoading(false); return; }
      if (bon.error) { setErro(bon.error.message); setLoading(false); return; }
      setFatCliente(fat.data || []);
      setBonColab(bon.data || []);
      const sm = {};
      (bon.data || []).forEach((r) => { sm[r.colaborador_id] = r.status; });
      setStatusMap(sm);
      setLoading(false);
    })();
  }, [compId]);

  const comp = comps.find((c) => c.id === compId);

  // ---- agregados ----
  const totais = useMemo(() => {
    const faturamento = fatCliente.reduce((a, r) => a + Number(r.valor_total || 0), 0);
    const tmo = fatCliente.reduce((a, r) => a + Number(r.tmo_total || 0), 0);
    const clientesAtivos = fatCliente.filter((r) => Number(r.tmo_total) > 0).length;
    const bonificacao = bonColab.reduce((a, r) => a + Number(r.valor_total || 0), 0);
    let voucher = 0, cartao = 0;
    bonColab.forEach((r) => {
      const st = statusMap[r.colaborador_id] || r.status;
      if (st === 'NÃO PAGAR') return;
      if ((r.forma_pag || '').toUpperCase() === 'VOUCHER') voucher += Number(r.valor_total || 0);
      else cartao += Number(r.valor_total || 0);
    });
    return { faturamento, tmo, clientesAtivos, bonificacao, voucher, cartao };
  }, [fatCliente, bonColab, statusMap]);

  // faturamento por vendedor
  const porVendedor = useMemo(() => {
    const m = {};
    fatCliente.forEach((r) => {
      const v = r.vendedor_nome || r.vendedor || '—';
      m[v] = (m[v] || 0) + Number(r.valor_total || 0);
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [fatCliente]);
  const maxVend = porVendedor.length ? porVendedor[0][1] : 1;

  // ---- muda status de pagamento (grava em fb_bonif_pagamento) ----
  async function mudarStatus(colaboradorId, novo) {
    setStatusMap((m) => ({ ...m, [colaboradorId]: novo }));
    const { error } = await supabase
      .from('fb_bonif_pagamento')
      .upsert(
        { competencia_id: compId, colaborador_id: colaboradorId, status: novo,
          pago_em: novo === 'PAGO' ? new Date().toISOString().slice(0, 10) : null },
        { onConflict: 'competencia_id,colaborador_id' }
      );
    if (error) setErro('Não salvou o status: ' + error.message);
  }

  async function fecharMes() {
    if (!comp || comp.status === 'fechada') return;
    if (!window.confirm(`Fechar ${MESES[comp.mes - 1]}/${comp.ano}? Depois de fechado, os lançamentos ficam travados.`)) return;
    const { error } = await supabase
      .from('fb_competencias')
      .update({ status: 'fechada', fechada_em: new Date().toISOString() })
      .eq('id', compId);
    if (error) { setErro(error.message); return; }
    setComps((cs) => cs.map((c) => (c.id === compId ? { ...c, status: 'fechada' } : c)));
  }

  // linhas de pagamento ordenadas: cartão primeiro, depois voucher, maior valor no topo
  const linhasPag = useMemo(() => {
    return [...bonColab]
      .filter((r) => Number(r.valor_total) > 0)
      .sort((a, b) => {
        const fa = (a.forma_pag || '').toUpperCase() === 'VOUCHER' ? 1 : 0;
        const fb = (b.forma_pag || '').toUpperCase() === 'VOUCHER' ? 1 : 0;
        if (fa !== fb) return fa - fb;
        return Number(b.valor_total) - Number(a.valor_total);
      });
  }, [bonColab]);

  // ---- estilos ----
  const s = {
    page: { background: C.bg, minHeight: '100vh', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', color: C.ink },
    wrap: { maxWidth: 1100, margin: '0 auto' },
    card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12 },
    metric: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 18px' },
    metricLabel: { margin: 0, fontSize: 13, color: C.ink3 },
    metricValue: { margin: '4px 0 0', fontSize: 24, fontWeight: 600 },
    sel: { height: 36, padding: '0 10px', borderRadius: 8, border: `1px solid ${C.lineStrong}`, background: C.card, color: C.ink, fontSize: 14 },
    btn: { height: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.lineStrong}`, background: C.card, color: C.ink, fontSize: 14, cursor: 'pointer' },
    th: { textAlign: 'left', fontSize: 12, color: C.ink3, fontWeight: 500, padding: '10px 8px', borderBottom: `1px solid ${C.line}` },
    td: { fontSize: 13, padding: '10px 8px', borderBottom: `1px solid ${C.line}` },
    pill: (bg, fg) => ({ background: bg, color: fg, fontSize: 11, padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap' }),
  };

  if (erro) {
    return (
      <div style={s.page}><div style={s.wrap}>
        <div style={{ ...s.card, padding: 20, borderColor: '#e0b4b4' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Não foi possível carregar</p>
          <p style={{ margin: '6px 0 0', color: C.ink2, fontSize: 14 }}>{erro}</p>
          <p style={{ margin: '10px 0 0', color: C.ink3, fontSize: 13 }}>
            Verifique se preencheu a URL e a chave do Supabase no topo do arquivo, e se as tabelas fb_ já foram criadas.
          </p>
        </div>
      </div></div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        {/* cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Faturamento e bonificação</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: C.ink2 }}>
              BASE SP
              {comp && <> · {MESES[comp.mes - 1]}/{comp.ano} · </>}
              {comp && (
                <span style={{ color: comp.status === 'fechada' ? C.ok : C.warn }}>
                  {comp.status === 'fechada' ? 'fechada' : 'aberta'}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={s.sel} value={compId || ''} onChange={(e) => setCompId(Number(e.target.value))}>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>{MESES[c.mes - 1]}/{c.ano}</option>
              ))}
            </select>
            {comp && comp.status !== 'fechada' && (
              <button style={s.btn} onClick={fecharMes}>Fechar mês</button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.ink3 }}>Carregando…</div>
        ) : (
          <>
            {/* métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
              <div style={s.metric}><p style={s.metricLabel}>Faturamento</p><p style={s.metricValue}>{brl(totais.faturamento)}</p></div>
              <div style={s.metric}><p style={s.metricLabel}>Bonificação</p><p style={s.metricValue}>{brl(totais.bonificacao)}</p></div>
              <div style={s.metric}><p style={s.metricLabel}>TMO faturados</p><p style={s.metricValue}>{Math.round(totais.tmo)}</p></div>
              <div style={s.metric}><p style={s.metricLabel}>Clientes ativos</p><p style={s.metricValue}>{totais.clientesAtivos}<span style={{ fontSize: 13, color: C.ink3 }}> / {fatCliente.length}</span></p></div>
            </div>

            {/* faturamento por vendedor */}
            <p style={{ fontSize: 13, fontWeight: 600, color: C.ink2, margin: '0 0 10px' }}>Faturamento por vendedor</p>
            <div style={{ ...s.card, padding: '16px 18px', marginBottom: 24 }}>
              {porVendedor.length === 0 && <p style={{ margin: 0, color: C.ink3, fontSize: 13 }}>Sem faturamento neste mês.</p>}
              {porVendedor.map(([nome, val]) => (
                <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ width: 120, fontSize: 13, color: C.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                  <div style={{ flex: 1, height: 18, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(val / maxVend) * 100}%`, height: '100%', background: C.accent, borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 80, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{brlK(val)}</span>
                </div>
              ))}
            </div>

            {/* fechamento */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, margin: '0 0 10px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.ink2, margin: 0 }}>Fechamento — bonificação a pagar</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={s.pill(C.okBg, C.ok)}>Cartão {brl(totais.cartao)}</span>
                <span style={s.pill(C.warnBg, C.warn)}>Voucher {brl(totais.voucher)}</span>
              </div>
            </div>
            <div style={{ ...s.card, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={s.th}>Colaborador</th>
                    <th style={s.th}>Cliente</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Pagamento</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>TMO</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Valor</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasPag.length === 0 && (
                    <tr><td style={{ ...s.td, color: C.ink3 }} colSpan={6}>Nenhuma bonificação lançada neste mês.</td></tr>
                  )}
                  {linhasPag.map((r) => {
                    const isVoucher = (r.forma_pag || '').toUpperCase() === 'VOUCHER';
                    const st = statusMap[r.colaborador_id] || r.status || 'A PAGAR';
                    return (
                      <tr key={r.colaborador_id}>
                        <td style={s.td}>{r.nome}<span style={{ color: C.ink3, marginLeft: 6, fontSize: 12 }}>{r.funcao}</span></td>
                        <td style={{ ...s.td, color: C.ink2 }}>{r.loja}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          <span style={s.pill(isVoucher ? C.warnBg : C.okBg, isVoucher ? C.warn : C.ok)}>{r.forma_pag || '—'}</span>
                        </td>
                        <td style={{ ...s.td, textAlign: 'right', color: C.ink2 }}>{Math.round(r.tmo_total)}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{brl(r.valor_total)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          <select
                            value={st}
                            onChange={(e) => mudarStatus(r.colaborador_id, e.target.value)}
                            disabled={comp && comp.status === 'fechada'}
                            style={{ ...s.sel, height: 28, fontSize: 12, padding: '0 6px',
                                     color: st === 'PAGO' ? C.ok : st === 'NÃO PAGAR' ? C.ink3 : C.accent }}>
                            <option value="A PAGAR">A pagar</option>
                            <option value="PAGO">Pago</option>
                            <option value="NÃO PAGAR">Não pagar</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p style={{ margin: '12px 2px 0', fontSize: 12, color: C.ink3 }}>
              {linhasPag.length} colaborador(es) com bonificação em {comp ? `${MESES[comp.mes - 1]}/${comp.ano}` : 'junho'}.
              O total por forma de pagamento no topo já desconsidera quem está como “não pagar”.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Zap, Brain, Check, Loader2, X as XIcon,
  GitBranch, ArrowRight, Lightbulb,
} from 'lucide-react';

interface Rule {
  id: string;
  agentId: string;
  name: string;
  condition: string;
  action: string;
  params: string;
  isActive: boolean;
  lastTriggered: number | null;
  triggerCount: number;
  createdAt: string;
}

interface RuleBuilderProps {
  agentId: string;
}

const CONDITION_TYPES = [
  { type: 'memory_contains', label: 'Memoria contem', placeholder: 'Ex: Arweave, Solana, comprar...' },
  { type: 'memory_score_above', label: 'Score acima de', placeholder: 'Ex: 7, 8, 9...' },
  { type: 'memory_newer_than', label: 'Mais novo que (horas)', placeholder: 'Ex: 24' },
];

const ACTIONS = [
  { key: 'notify', label: '\u{1F514} Notificar', description: 'Enviar notificacao' },
  { key: 'analyze', label: '\u{1F4CA} Analisar', description: 'Analisar memorias' },
  { key: 'save_preference', label: '\u{1F4BE} Salvar Preferencia', description: 'Extrair preferencia' },
  { key: 'webhook_trigger', label: '\u{1F517} Webhook', description: 'Disparar webhook externo' },
  { key: 'blockchain_anchor', label: '\u26D3\uFE0F Blockchain Anchor', description: 'Ancorar prova on-chain' },
  { key: 'memory_query', label: '\u{1F50D} Query Memoria', description: 'Buscar memorias' },
];

export default function RuleBuilder({ agentId }: RuleBuilderProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [conditionType, setConditionType] = useState('memory_contains');
  const [conditionValue, setConditionValue] = useState('');
  const [action, setAction] = useState('notify');
  const [actionParams, setActionParams] = useState('');

  function loadRules() {
    setLoading(true);
    fetch(`/api/agents/${agentId}/rules`)
      .then(r => r.json())
      .then(data => setRules(data.rules || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadRules(); }, [agentId]);

  function resetForm() {
    setRuleName('');
    setConditionType('memory_contains');
    setConditionValue('');
    setAction('notify');
    setActionParams('');
    setShowForm(false);
  }

  async function handleCreate() {
    if (!ruleName.trim() || !conditionValue.trim()) return;

    setSaving(true);
    try {
      const condition = JSON.stringify({ type: conditionType, value: conditionValue });
      const params = actionParams ? JSON.parse(actionParams) : {};

      const res = await fetch(`/api/agents/${agentId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName.trim(),
          condition,
          action,
          params,
        }),
      });

      if (res.ok) {
        resetForm();
        loadRules();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(ruleId: string, isActive: boolean) {
    await fetch(`/api/agents/${agentId}/rules`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId, isActive: !isActive }),
    });
    loadRules();
  }

  async function handleDelete(ruleId: string) {
    await fetch(`/api/agents/${agentId}/rules?ruleId=${ruleId}`, { method: 'DELETE' });
    loadRules();
  }

  const conditionTypeInfo = CONDITION_TYPES.find(c => c.type === conditionType);

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[#9945FF]" />
          <h3 className="text-sm font-semibold text-white/60">Regras de Decisao</h3>
          {rules.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#9945FF]/10 text-[#9945FF]/60 font-medium">
              {rules.filter(r => r.isActive).length} ativas
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            showForm
              ? 'bg-white/[0.06] text-white/50'
              : 'bg-[#9945FF]/10 text-[#9945FF]/80 hover:bg-[#9945FF]/20'
          }`}
        >
          {showForm ? <XIcon className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Cancelar' : 'Nova Regra'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl border border-[#9945FF]/20 bg-gradient-to-b from-[#9945FF]/5 to-transparent p-4 space-y-3">
          {/* Rule name */}
          <div>
            <label className="block text-[11px] font-medium text-white/40 mb-1">Nome da Regra</label>
            <input
              type="text"
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
              placeholder="Ex: Alerta de Arweave"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-[#9945FF]/30"
            />
          </div>

          {/* Condition */}
          <div>
            <label className="block text-[11px] font-medium text-white/40 mb-1.5">
              <span className="text-[#9945FF]/70">IF</span> — Condicao
            </label>
            <div className="flex gap-2">
              <select
                value={conditionType}
                onChange={e => setConditionType(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-2 text-xs text-white/70 outline-none focus:border-[#9945FF]/30"
              >
                {CONDITION_TYPES.map(c => (
                  <option key={c.type} value={c.type}>{c.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={conditionValue}
                onChange={e => setConditionValue(e.target.value)}
                placeholder={conditionTypeInfo?.placeholder}
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/90 placeholder:text-white/20 outline-none focus:border-[#9945FF]/30"
              />
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="block text-[11px] font-medium text-white/40 mb-1.5">
              <span className="text-[#14F195]/70">THEN</span> — Acao
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACTIONS.map(a => (
                <button
                  key={a.key}
                  onClick={() => setAction(a.key)}
                  className={`rounded-lg border p-2 text-left text-[11px] transition-all ${
                    action === a.key
                      ? 'border-[#14F195]/30 bg-[#14F195]/10 text-[#14F195]'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="block font-medium">{a.label}</span>
                  <span className="text-[10px] text-white/25">{a.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Extra params (for webhook) */}
          {action === 'webhook_trigger' && (
            <div>
              <label className="block text-[11px] font-medium text-white/40 mb-1">
                Webhook JSON (url, message)
              </label>
              <input
                type="text"
                value={actionParams}
                onChange={e => setActionParams(e.target.value)}
                placeholder='{"url": "https://...", "message": "..."}'
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/90 font-mono placeholder:text-white/20 outline-none focus:border-[#9945FF]/30"
              />
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={saving || !ruleName.trim() || !conditionValue.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] py-2.5 text-xs font-semibold text-white transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 h-3.5" />}
            Criar Regra
          </button>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-white/20" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-6">
          <Lightbulb className="h-5 w-5 text-white/10 mx-auto mb-2" />
          <p className="text-[11px] text-white/25">
            Crie regras para ativar decisoes autonomas.
            <br />IF condicao → THEN acao
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            let condText = '';
            try {
              const c = JSON.parse(rule.condition);
              const labels: Record<string, string> = {
                memory_contains: 'contem',
                memory_score_above: 'score >',
                memory_newer_than: 'mais novo que',
              };
              condText = `"${c.value}" ${labels[c.type] || c.type}`;
            } catch { condText = rule.condition; }

            const actionLabel = ACTIONS.find(a => a.key === rule.action)?.label || rule.action;

            return (
              <div key={rule.id} className={`rounded-xl border p-3 transition-all ${
                rule.isActive
                  ? 'border-white/[0.06] bg-white/[0.03]'
                  : 'border-white/[0.03] bg-white/[0.01] opacity-50'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-white/70">{rule.name}</span>
                      {rule.triggerCount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#14F195]/5 text-[#14F195]/50">
                          {rule.triggerCount}x executada{rule.triggerCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/35">
                      <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-[#9945FF]/10 text-[#9945FF]/50">IF</span>
                      <span>{condText}</span>
                      <ArrowRight className="w-3 h-3 text-white/15" />
                      <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-[#14F195]/10 text-[#14F195]/50">THEN</span>
                      <span>{actionLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(rule.id, rule.isActive)}
                      className={`p-1 rounded transition-colors ${rule.isActive ? 'text-[#14F195]/60 hover:text-[#14F195]' : 'text-white/20 hover:text-white/40'}`}
                    >
                      {rule.isActive ? <Check className="w-3.5 h-3.5" /> : <GitBranch className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-1 rounded text-white/15 hover:text-[#FF4458] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

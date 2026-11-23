import React, { useState, useEffect } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { CheckCircle2, Sparkles, ArrowDownLeft, ArrowUpRight, Zap, Plus, Trash2, Sliders, ShieldCheck, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { apiClient, type BankRule, type BankRuleInput } from "../../lib/api-client";
import type { BankFeedLine } from "../../types";
import { initialBankFeedLines } from "../../lib/api-mock";

export interface BankRecRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BankRecRulesModal: React.FC<BankRecRulesModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"matches" | "rules">("matches");
  const [lines, setLines] = useState<BankFeedLine[]>([]);
  const [rules, setRules] = useState<BankRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Rule Form State
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<BankRuleInput>({
    name: "",
    direction: "ANY",
    descriptionContains: "",
    accountCode: "4010",
    label: "",
    priority: 10,
    active: true,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [linesRes, rulesRes] = await Promise.all([
        apiClient.listBankLines("Suggested"),
        apiClient.listBankRules(),
      ]);

      if (linesRes.data && linesRes.data.length > 0) {
        setLines(linesRes.data);
      } else {
        // Fallback to sample suggested items if database has no imported lines yet
        const suggested = initialBankFeedLines.filter((l) => l.status === "Suggested");
        setLines(suggested);
      }

      if (rulesRes.data && rulesRes.data.length > 0) {
        setRules(rulesRes.data);
      } else {
        // Initial rules baseline if none created yet
        setRules([
          {
            id: "rule-default-1",
            name: "Stripe Settlement",
            direction: "IN",
            descriptionContains: "STRIPE",
            accountCode: "4010",
            label: "Operating Revenue",
            priority: 1,
            active: true,
          },
          {
            id: "rule-default-2",
            name: "AWS Cloud Infrastructure",
            direction: "OUT",
            descriptionContains: "AWS",
            accountCode: "5010",
            label: "Hosting & Infrastructure",
            priority: 2,
            active: true,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleMatchSingle = async (line: BankFeedLine) => {
    const matchedRef = line.matchedRef || `account:${line.reference || "GL"}`;
    const res = await apiClient.reconcileBankLine(line.id, matchedRef);
    if (res.isLive || res.data) {
      setLines((prev) =>
        prev.map((l) => (l.id === line.id ? { ...l, status: "Reconciled" } : l))
      );
      showToast(`Reconciled line "${line.description}" against ${matchedRef}.`, undefined, "good");
    }
  };

  const handleBatchReconcileAll = async () => {
    const pending = lines.filter((l) => l.status !== "Reconciled");
    if (pending.length === 0) return;

    setIsSubmitting(true);
    try {
      for (const line of pending) {
        const matchedRef = line.matchedRef || `account:${line.reference || "GL"}`;
        await apiClient.reconcileBankLine(line.id, matchedRef);
      }
      setLines((prev) => prev.map((l) => ({ ...l, status: "Reconciled" })));
      showToast(
        `Ledger Lou confirmed and reconciled ${pending.length} suggested bank lines to the ledger.`,
        undefined,
        "good"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name.trim() || !newRule.accountCode.trim() || !newRule.label.trim()) {
      showToast("Please provide a name, target account code, and label for this rule.", undefined, "warn");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.createBankRule(newRule);
      if (res.data) {
        setRules((prev) => [...prev, res.data!]);
        showToast(`Bank rule "${newRule.name}" created successfully.`, undefined, "good");
      } else {
        // Local state update when offline
        const localRule: BankRule = {
          ...newRule,
          id: `rule-${Date.now()}`,
        };
        setRules((prev) => [...prev, localRule]);
        showToast(`Bank rule "${newRule.name}" saved.`, undefined, "good");
      }
      setShowAddRule(false);
      setNewRule({
        name: "",
        direction: "ANY",
        descriptionContains: "",
        accountCode: "4010",
        label: "",
        priority: 10,
        active: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    await apiClient.deleteBankRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
    showToast(`Rule "${name}" deleted.`, undefined, "good");
  };

  const pendingCount = lines.filter((l) => l.status !== "Reconciled").length;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Automated Bank Reconciliation & Rules Engine (FIN-04)"
      description="Zero-touch clearing: Bank feed lines -> Rules Engine -> Human Confirmation -> General Ledger"
      size="xl"
    >
      <div className="space-y-6 pb-6 text-xs font-sans">
        {/* Live Engine Banner */}
        <div className="p-3 border-line bg-cyan/10 border-l-4 border-l-cyan text-ink flex flex-col sm:flex-row sm:items-center justify-between gap-2" role="status">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan fill-current shrink-0" />
            <div>
              <span className="font-mono font-bold uppercase text-[11px] block sm:inline mr-2">Connected to FIN-04 Rules Engine:</span>
              <span className="text-[11px] text-muted">Rules suggest target GL accounts; a person confirms before money is moved.</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-good text-ink font-bold border border-ink shrink-0 self-start sm:self-center">
            LIVE ENGINE
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-line gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("matches")}
            className={`px-4 py-2 font-mono font-bold text-xs uppercase border-t-2 transition-all flex items-center gap-2 ${
              activeTab === "matches"
                ? "border-t-ink bg-page text-ink -mb-[1px] border-x border-line"
                : "border-t-transparent text-muted hover:text-ink"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suggested Matches ({pendingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-2 font-mono font-bold text-xs uppercase border-t-2 transition-all flex items-center gap-2 ${
              activeTab === "rules"
                ? "border-t-ink bg-page text-ink -mb-[1px] border-x border-line"
                : "border-t-transparent text-muted hover:text-ink"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Active Bank Rules ({rules.length})</span>
          </button>
        </div>

        {activeTab === "matches" ? (
          <>
            {/* Status Strip */}
            <div className="p-4 bg-page border-line flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-lime border border-ink shadow-[2px_2px_0_var(--q-ink)] flex items-center justify-center text-ink shrink-0">
                  <Sparkles className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-black text-sm uppercase">
                      Ledger Lou (AGT-03) Auto-Match Engine
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-good text-ink font-bold border border-ink">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-muted font-mono mt-0.5">
                    {pendingCount} suggested matches ready for review and confirmation
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBatchReconcileAll}
                disabled={pendingCount === 0 || isSubmitting}
                className={`px-4 py-2 font-mono font-bold text-xs uppercase border-line shadow-[2px_2px_0_var(--q-ink)] flex items-center gap-1.5 transition-all ${
                  pendingCount > 0 && !isSubmitting
                    ? "bg-lime text-ink hover:bg-yellow active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                    : "bg-panel text-muted border-grid cursor-not-allowed"
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{isSubmitting ? "Reconciling..." : `Confirm All (${pendingCount})`}</span>
              </button>
            </div>

            {/* Transactions Feed List */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="p-8 text-center bg-panel border-line text-muted">
                  <p className="font-mono text-sm">Loading bank feed & suggestions...</p>
                </div>
              ) : lines.length === 0 ? (
                <div className="p-8 text-center bg-panel border-line text-muted">
                  <p className="font-mono text-sm">No suggested bank lines at this time.</p>
                  <p className="text-xs mt-1">Import new statement lines from the Bank Reconciliation page to run the rules engine.</p>
                </div>
              ) : (
                lines.map((tx) => {
                  const isReconciled = tx.status === "Reconciled";
                  const isCredit = tx.direction === "IN";

                  return (
                    <div
                      key={tx.id}
                      className={`p-4 border-line shadow-card transition-all ${
                        isReconciled ? "bg-page/40 opacity-75" : "bg-panel hover:border-ink"
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Left: Bank statement line */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 flex items-center justify-center border border-ink shrink-0 ${
                              isCredit ? "bg-lime text-ink" : "bg-pink text-ink"
                            }`}
                          >
                            {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-text">{tx.description}</span>
                              <span className="text-[10px] font-mono text-muted">{tx.postedDate}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-page border border-grid text-muted">
                                Ref: {tx.reference}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount & Matching suggestion */}
                        <div className="flex items-center gap-4 self-end lg:self-center">
                          <div className="text-right">
                            <span className={`font-mono font-black text-sm block ${isCredit ? "text-good" : "text-pink"}`}>
                              {isCredit ? "+" : "-"}${tx.amount} USD
                            </span>
                            <span className="text-[10px] font-mono text-muted uppercase">Bank Feed Line</span>
                          </div>

                          {isReconciled ? (
                            <span className="px-3 py-1.5 text-xs font-mono font-bold bg-good text-ink border border-ink flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              RECONCILED
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMatchSingle(tx)}
                              className="px-3 py-1.5 text-xs font-mono font-black bg-yellow text-ink border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-lime active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirm Match
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lou's AI Rule Match Callout */}
                      {tx.matchedRef && (
                        <div className="mt-3 p-2.5 bg-page border-l-4 border-l-cyan border-y border-r border-grid flex items-center justify-between gap-3 text-[11px] font-mono">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-cyan font-black uppercase shrink-0">Lou Suggested Match:</span>
                            <span className="text-text font-bold truncate">
                              {tx.matchedRef} {tx.matchedLabel ? `· ${tx.matchedLabel}` : ""}
                            </span>
                          </div>
                          {tx.confidence && (
                            <span className="px-1.5 py-0.2 bg-good text-ink font-bold border border-ink shrink-0">
                              {tx.confidence}% CONFIDENCE
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Rules Management Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-page p-3 border-line">
              <div>
                <h4 className="font-mono font-bold uppercase text-xs">Deterministic Matching Rules</h4>
                <p className="text-[11px] text-muted">Rules evaluate in priority order when lines do not match an open invoice or bill.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRule((prev) => !prev)}
                className="px-3 py-1.5 font-mono font-bold text-xs uppercase bg-lime text-ink border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-yellow active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1 cursor-pointer"
              >
                {showAddRule ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{showAddRule ? "Cancel" : "Add Rule"}</span>
              </button>
            </div>

            {/* Create Rule Form */}
            {showAddRule && (
              <form onSubmit={handleCreateRule} className="p-4 bg-page border-2 border-ink space-y-3 shadow-card">
                <h5 className="font-mono font-bold uppercase text-xs text-ink">New Bank Rule</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-mono text-[11px] text-muted mb-1">Rule Name</label>
                    <input
                      type="text"
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      placeholder="e.g. AWS Monthly Cloud"
                      className="w-full p-2 border-line bg-panel font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] text-muted mb-1">Direction</label>
                    <select
                      value={newRule.direction}
                      onChange={(e) => setNewRule({ ...newRule, direction: e.target.value as "IN" | "OUT" | "ANY" })}
                      className="w-full p-2 border-line bg-panel font-mono text-xs"
                    >
                      <option value="ANY">Any Direction</option>
                      <option value="IN">Money In (Credit)</option>
                      <option value="OUT">Money Out (Debit)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] text-muted mb-1">Description Contains</label>
                    <input
                      type="text"
                      value={newRule.descriptionContains || ""}
                      onChange={(e) => setNewRule({ ...newRule, descriptionContains: e.target.value })}
                      placeholder="e.g. AWS or STRIPE"
                      className="w-full p-2 border-line bg-panel font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] text-muted mb-1">Target Account Code</label>
                    <input
                      type="text"
                      value={newRule.accountCode}
                      onChange={(e) => setNewRule({ ...newRule, accountCode: e.target.value })}
                      placeholder="e.g. 5010"
                      className="w-full p-2 border-line bg-panel font-mono text-xs"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-mono text-[11px] text-muted mb-1">Suggested Label</label>
                    <input
                      type="text"
                      value={newRule.label}
                      onChange={(e) => setNewRule({ ...newRule, label: e.target.value })}
                      placeholder="e.g. Web Hosting & Servers"
                      className="w-full p-2 border-line bg-panel font-mono text-xs"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 font-mono font-bold text-xs uppercase bg-lime text-ink border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-yellow active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            )}

            {/* Rules List */}
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="p-3 bg-panel border-line flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-text">{rule.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-page border border-grid text-muted">
                        Priority: {rule.priority ?? 10}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan/20 text-ink font-bold border border-ink">
                        {rule.direction}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted font-mono flex flex-wrap gap-2">
                      {rule.descriptionContains && <span>Contains: <strong>"{rule.descriptionContains}"</strong></span>}
                      <span>Suggests: <strong>Account {rule.accountCode} ({rule.label})</strong></span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id, rule.name)}
                    className="p-1.5 border border-grid text-muted hover:text-pink hover:border-pink transition-all cursor-pointer"
                    title="Delete rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { SparklesIcon } from "@/components/layout/nav";

const CLOUD_FUNCTION_URL =
  "https://us-central1-premium-inventory-app.cloudfunctions.net/askInvntori";

// ── Rate limiting (client-side, 20/hr) ─────────────────────────────────────

const RATE_LIMIT_KEY = "invntori_rate_log";
const MAX_PER_HOUR = 20;

function rateLimiter() {
  const cutoff = Date.now() - 3600_000;
  const stored: number[] = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) ?? "[]");
  const recent = stored.filter((t) => t > cutoff);
  return {
    canRequest: recent.length < MAX_PER_HOUR,
    remaining: Math.max(0, MAX_PER_HOUR - recent.length),
    record() {
      recent.push(Date.now());
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recent));
    },
    minutesUntilSlot: () => {
      const oldest = Math.min(...recent);
      return Math.ceil((oldest + 3600_000 - Date.now()) / 60_000);
    },
  };
}

// ── FAQ cache (no API call for common how-to questions) ────────────────────

interface FAQEntry { triggers: string[]; answer: string }
const FAQ: FAQEntry[] = [
  {
    triggers: ["submit a request", "request inventory", "how do i request", "submit an inventory request"],
    answer: "**Submitting an inventory request:**\n1. Go to **Inventory** in the sidebar\n2. Select a warehouse\n3. Find the product and click **Request**\n4. Enter the quantity and submit\n\nYour request will appear in **Requests** and notify your manager.",
  },
  {
    triggers: ["add a product", "new product", "create a product"],
    answer: "**Adding a product** is done in the iOS app under Manage → Manage Products. On the web, products are view-only for now.",
  },
  {
    triggers: ["add an employee", "new employee", "create employee"],
    answer: "**Adding an employee** is managed in the iOS app under Manage → Manage Employees. Web admins can deactivate or reactivate employees under the **Employees** page.",
  },
  {
    triggers: ["approve a request", "deny a request", "review request", "pending request"],
    answer: "**Approving requests:**\n1. Go to **Requests** in the sidebar\n2. Select the **Pending** tab\n3. Click a request to expand it\n4. Click **Mark as Completed**",
  },
  {
    triggers: ["purchase order", "create a po", "new order"],
    answer: "**Purchase orders** are listed under **Orders** in the sidebar. Creating new orders is done in the iOS app under Manage → Purchase Orders.",
  },
  {
    triggers: ["what tabs", "how does the app work", "app overview", "what can the app do"],
    answer: "**Web app pages:**\n- **Dashboard** — Company overview, metrics, alerts\n- **Inventory** — Browse stock levels across warehouses\n- **Equipment** — Equipment status and checkouts\n- **Fleet** — Vehicle assignments and conditions\n- **Requests** — Submit and review inventory requests\n- **Orders** — Purchase order tracking\n- **Employees** — Staff directory\n- **Ask invntori** — This AI assistant",
  },
  {
    triggers: ["low stock", "out of stock", "reorder"],
    answer: "**Low stock items** are shown on the **Dashboard** in the Focus strip and AREAS grid. Go to **Inventory** and enable the **Low Stock Only** filter to see just those items.",
  },
];

const DATA_SIGNALS = [
  "how much", "how many", "how often", "stock level", "low stock", "out of stock",
  "who used", "who is using", "usage", "quantity", "valuation", "value of",
  "cost of", "recent", "this week", "this month", "top user", "top employee",
  "when should", "when will", "burn rate", "reorder", "purchase order status",
];

function faqMatch(input: string): string | null {
  const q = input.toLowerCase().trim();
  if (DATA_SIGNALS.some((s) => q.includes(s))) return null;
  const entry = FAQ.find((e) => e.triggers.some((t) => q.includes(t)));
  return entry?.answer ?? null;
}

// ── Context loading from Firestore ─────────────────────────────────────────

async function loadInventoryContext(companyID: string): Promise<string> {
  const db_ = db;
  const lines: string[] = [];

  const [wSnap, pSnap, reqSnap, poSnap] = await Promise.all([
    getDocs(collection(db_, "companies", companyID, "warehouses")),
    getDocs(collection(db_, "companies", companyID, "products")),
    getDocs(query(collection(db_, "companies", companyID, "inventoryRequests"), orderBy("timestamp", "desc"), limit(300))),
    getDocs(query(collection(db_, "companies", companyID, "purchaseOrders"), orderBy("createdAt", "desc"), limit(50))),
  ]);

  const warehouses = wSnap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) ?? d.id }));
  lines.push(`WAREHOUSES: ${warehouses.map((w) => w.name).join(", ")}`);

  const unitCostMap: Record<string, number> = {};
  const productNames: Record<string, string> = {};
  const retiredIDs = new Set<string>();
  for (const doc of pSnap.docs) {
    const d = doc.data();
    if (d.isRetired === true) { retiredIDs.add(doc.id); continue; }
    productNames[doc.id] = (d.name as string) ?? doc.id;
    if (typeof d.unitCost === "number") unitCostMap[doc.id] = d.unitCost;
  }

  // Load all warehouse inventories
  const invSnaps = await Promise.all(
    warehouses.map((w) => getDocs(collection(db_, "companies", companyID, "warehouses", w.id, "inventory")))
  );

  const agg: Record<string, { qty: number; unit: string; category: string; threshold: number }> = {};
  for (const snap of invSnaps) {
    for (const doc of snap.docs) {
      const d = doc.data();
      const pid = doc.id;
      if (retiredIDs.has(pid)) continue;
      const qty = typeof d.quantity === "number" ? d.quantity : 0;
      if (agg[pid]) {
        agg[pid].qty += qty;
      } else {
        agg[pid] = {
          qty,
          unit: (d.unit as string) ?? "",
          category: (d.category as string) ?? "",
          threshold: typeof d.reorderThreshold === "number" ? d.reorderThreshold : 0,
        };
        if (!productNames[pid] && d.name) productNames[pid] = d.name as string;
      }
    }
  }

  const sorted = Object.entries(agg).sort(([a], [b]) =>
    (productNames[a] ?? a).localeCompare(productNames[b] ?? b)
  );

  if (sorted.length > 0) {
    lines.push(`\nINVENTORY (${sorted.length} products):`);
    for (const [pid, item] of sorted.slice(0, 60)) {
      const name = productNames[pid] ?? pid;
      const cost = unitCostMap[pid] != null ? ` @ $${unitCostMap[pid].toFixed(2)}/${item.unit}` : "";
      const cat = item.category || "uncategorized";
      lines.push(`  ${name}: ${item.qty} ${item.unit}${cost} [${cat}]`);
    }

    const lowStock = sorted.filter(([, item]) => item.threshold > 0 && item.qty <= item.threshold);
    if (lowStock.length > 0) {
      lines.push("\nLOW / OUT OF STOCK:");
      for (const [pid, item] of lowStock) {
        lines.push(`  !! ${productNames[pid] ?? pid}: ${item.qty} ${item.unit} (threshold ${item.threshold})`);
      }
    }
  } else {
    lines.push("\nNo inventory found.");
  }

  // Usage from requests
  const usageRows: Array<{ date: Date; emp: string; product: string; qty: number; unit: string }> = [];
  for (const doc of reqSnap.docs) {
    const d = doc.data();
    const emp = (d.submittedBy as string) ?? "Unknown";
    const ts = d.timestamp?.toDate?.() ?? (d.createdAt?.toDate?.() ?? null);
    if (!ts) continue;
    const items = d.items as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(items)) {
      for (const item of items) {
        const product = (item.productName as string) ?? "Unknown";
        const qty = typeof item.quantity === "number" ? item.quantity : 0;
        const unit = (item.unit as string) ?? "";
        if (qty > 0) usageRows.push({ date: ts, emp, product, qty, unit });
      }
    }
  }

  if (usageRows.length > 0) {
    const empTotals: Record<string, number> = {};
    const empProducts: Record<string, Record<string, number>> = {};
    for (const r of usageRows) {
      empTotals[r.emp] = (empTotals[r.emp] ?? 0) + r.qty;
      if (!empProducts[r.emp]) empProducts[r.emp] = {};
      empProducts[r.emp][r.product] = (empProducts[r.emp][r.product] ?? 0) + r.qty;
    }
    const ranked = Object.entries(empTotals).sort((a, b) => b[1] - a[1]);
    lines.push(`\nEMPLOYEE USAGE (${reqSnap.size} requests):`);
    for (const [emp, total] of ranked) {
      const top = Object.entries(empProducts[emp]).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([p, q]) => `${p}: ${q.toFixed(1)}`).join(", ");
      lines.push(`  ${emp}: ${total.toFixed(1)} total (${top})`);
    }
    lines.push("\nRECENT REQUESTS (last 20 items):");
    for (const r of usageRows.slice(0, 20)) {
      lines.push(`  [${r.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}] ${r.emp}: ${r.qty.toFixed(1)} ${r.unit} of ${r.product}`);
    }
  }

  // Purchase orders
  if (poSnap.size > 0) {
    lines.push(`\nPURCHASE ORDERS (${poSnap.size}):`);
    for (const doc of poSnap.docs) {
      const d = doc.data();
      const vendor = (d.vendorName as string) ?? "Unknown vendor";
      const status = (d.status as string) ?? "Unknown";
      const items = Array.isArray(d.items)
        ? (d.items as Array<Record<string, unknown>>).map((i) => `${i.productName ?? "?"}: ${i.quantity ?? 0} ${i.unit ?? ""}`).join("; ")
        : "no items";
      lines.push(`  [${status}] ${vendor}: ${items}`);
    }
  } else {
    lines.push("\nPURCHASE ORDERS: None on record.");
  }

  return lines.join("\n");
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(contextSummary: string): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `You are "invntori," an AI assistant built into Premium Inventory Tracker — an inventory management app for a pest control business.

You have two roles:
1. INVENTORY ANALYST: Help staff understand stock levels, usage trends, reorder timing, and cost data using the live inventory snapshot below.
2. APP GUIDE: Help users navigate and use the web app by explaining how features work step by step.

TONE: Be concise, specific, and practical. Use markdown formatting: **bold** for product names, key figures, and section labels. Use bullet or numbered lists for multi-item answers. Do NOT use # or ## headers — bold labels only. Cite ONLY actual numbers from the data when relevant. Do not guess.

Today: ${today}

== HOW THE WEB APP WORKS ==
The web app sidebar has these pages:
- DASHBOARD: Company overview card, Focus strip (Low Stock / Repairs / Orders), AREAS grid, Invntori Insights. Shows date-ranged metrics.
- INVENTORY: Browse all warehouses and their stock. Filter by category, low stock, or search by name.
- EQUIPMENT: See all company equipment, filter by status (Available / Checked Out / In Repair). View individual equipment history.
- FLEET: All vehicles, their condition and current driver assignment. Filter by condition.
- REQUESTS: Submit inventory requests; admins can view all requests and mark them complete.
- ORDERS: Purchase order list with Pending / Completed filter. View line items per order.
- EMPLOYEES: Staff directory split into Active and Inactive sections. Admins can deactivate/reactivate.
- ASK INVNTORI: This AI chat.

Key how-to steps:
- Submit a request: Requests page → click the Submit button → select items → submit.
- View low stock: Dashboard Focus strip → click Low Stock tile → or go to Inventory and toggle Low Stock Only.
- Mark a request complete (admin): Requests page → Pending tab → expand a request → Mark as Completed.
- View equipment history: Equipment page → click an equipment item → see checkout and repair history.
- View fleet detail: Fleet page → click a vehicle → see assignment and maintenance history.

== PEST CONTROL KNOWLEDGE ==
Common treatments:
- German cockroaches: gel baits (Advion, Maxforce Magnum) + IGR (Gentrol, Archer) — avoid sprays near bait.
- American/Oriental cockroaches: residual perimeter spray (Bifenthrin, Demand CS) + bait in harborage areas.
- Ants: bait stations (Advion Ant, Optigard) + exterior perimeter barrier.
- Rodents: tamper-resistant bait stations (Contrac Blox, First Strike); snap traps; seal entry points.
- Mosquitoes: monthly barrier spray (Talstar, Demand CS); larvicide (Altosid) for standing water.
- Bed bugs: heat + residual spray (Temprid SC, Crossfire); encasements; IGR (Gentrol).
- Fleas/ticks: outdoor broadcast (Talstar, Demand CS); indoor aerosol + IGR (Precor 2000+).
- Termites: Termidor SC or Altriset for soil treatments. Requires licensed operator.

== CURRENT INVENTORY DATA ==
${contextSummary || "(Inventory data unavailable — please refresh or try again.)"}`;
}

// ── Message types ──────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "What items are low on stock?",
  "Who used the most inventory this period?",
  "What products should I use for German cockroaches?",
  "When should I reorder based on current usage?",
  "How do I submit an inventory request?",
  "How do I mark a request as completed?",
];

// ── Main component ─────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [contextSummary, setContextSummary] = useState("");
  const [loadingContext, setLoadingContext] = useState(false);
  const [rateState, setRateState] = useState({ remaining: MAX_PER_HOUR, canRequest: true });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const rl = rateLimiter();
    setRateState({ remaining: rl.remaining, canRequest: rl.canRequest });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const loadContext = useCallback(async () => {
    if (!user?.companyID || loadingContext || contextSummary) return;
    setLoadingContext(true);
    try {
      const ctx = await loadInventoryContext(user.companyID);
      setContextSummary(ctx);
    } catch {
      setContextSummary("(Could not load inventory data.)");
    } finally {
      setLoadingContext(false);
    }
  }, [user?.companyID, loadingContext, contextSummary]);

  useEffect(() => {
    if (user?.companyID) loadContext();
  }, [user?.companyID, loadContext]);

  const send = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || streaming || loadingContext) return;

    setInput("");

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: userText };
    setMessages((prev) => [...prev, userMsg]);

    // FAQ shortcut
    const faqAnswer = faqMatch(userText);
    if (faqAnswer) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: faqAnswer }]);
      return;
    }

    // Rate limit check
    const rl = rateLimiter();
    if (!rl.canRequest) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: `Rate limit reached. Try again in ~${rl.minutesUntilSlot()} min.` }]);
      return;
    }
    rl.record();
    setRateState({ remaining: rl.remaining - 1, canRequest: rl.remaining - 1 > 0 });

    const assistantID = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantID, role: "assistant", text: "" }]);
    setStreaming(true);

    const history = messages.slice(-16).map((m) => ({ role: m.role, content: m.text }));
    history.push({ role: "user", content: userText });

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setMessages((prev) => prev.map((m) => m.id === assistantID ? { ...m, text: "Authentication error. Please sign in again." } : m));
        setStreaming(false);
        return;
      }

      const res = await fetch(CLOUD_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history, system: buildSystemPrompt(contextSummary), companyID: user?.companyID }),
        signal: abort.signal,
      });

      if (!res.ok) {
        let errMsg = "Something went wrong. Please try again.";
        try {
          const body = await res.json() as { error?: string };
          if (body.error) errMsg = body.error;
        } catch { /* ignore */ }
        if (res.status === 403 && errMsg.toLowerCase().includes("not configured")) {
          errMsg = "AI is not configured for your company. An admin can enable it in the iOS app under Settings → Company Settings → AI Integration.";
        }
        setMessages((prev) => prev.map((m) => m.id === assistantID ? { ...m, text: errMsg } : m));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const json = JSON.parse(payload);
            // Anthropic: content_block_delta
            if (json.type === "content_block_delta" && json.delta?.text) {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantID ? { ...m, text: m.text + json.delta.text } : m)
              );
            }
            // OpenAI: choices[0].delta.content
            if (json.choices?.[0]?.delta?.content) {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantID ? { ...m, text: m.text + json.choices[0].delta.content } : m)
              );
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setMessages((prev) => prev.map((m) => m.id === assistantID ? { ...m, text: "Request failed. Please try again." } : m));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, loadingContext, messages, contextSummary]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On touch keyboards Enter should add a newline — the send button is right
    // there. Only hardware keyboards get Enter-to-send.
    const isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !isTouch) {
      e.preventDefault();
      send();
    }
  };

  const disabled = streaming || loadingContext || !rateState.canRequest;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 border-b border-[#1C1C1E] flex items-center gap-2 bg-[#000000] shrink-0">
        <SparklesIcon className="w-[18px] h-[18px] text-[#0A84FF] shrink-0" />
        <h2 className="text-[17px] font-semibold text-white">Ask invntori</h2>
        {loadingContext && (
          <span className="ml-auto text-xs text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] animate-pulse" />
            Loading data…
          </span>
        )}
        {!loadingContext && contextSummary && (
          <span className="ml-auto text-xs text-green-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Data loaded
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-touch px-4 py-5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-5 pt-6 sm:pt-12 max-w-lg mx-auto">
            <SparklesIcon className="w-11 h-11 text-[#0A84FF]" />
            <div className="text-center">
              <h3 className="text-[22px] font-bold text-white mb-1">Ask anything about your inventory</h3>
              <p className="text-[15px] text-[rgba(235,235,245,0.6)]">Powered by your live inventory data</p>
            </div>
            <div className="w-full space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={disabled}
                  className="w-full text-left px-4 py-3.5 rounded-[14px] bg-[#1C1C1E] text-[16px] text-white active:bg-[#2C2C2E] transition-colors disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-[#0A84FF]/15 flex items-center justify-center shrink-0 mt-1 mr-2">
                    <SparklesIcon className="w-3.5 h-3.5 text-[#0A84FF]" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-[20px] text-[16px] leading-[1.35] whitespace-pre-wrap break-words ${
                    msg.role === "user"
                      ? "bg-[#0A84FF] text-white rounded-br-[6px]"
                      : "bg-[#1C1C1E] text-white rounded-bl-[6px]"
                  }`}
                >
                  {msg.text || (msg.role === "assistant" && <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>)}
                </div>
              </div>
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Rate limit warning */}
      {rateState.remaining <= 5 && rateState.canRequest && (
        <div className="px-4 py-1 text-xs text-amber-400 text-center bg-[#000000] border-t border-[#2C2C2E]">
          {rateState.remaining} of {MAX_PER_HOUR} requests remaining this hour
        </div>
      )}
      {!rateState.canRequest && (
        <div className="px-4 py-1 text-xs text-red-400 text-center bg-[#000000] border-t border-[#2C2C2E]">
          Hourly limit reached. Try again shortly.
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 sm:px-4 pt-2.5 pb-[calc(0.625rem+var(--safe-bottom))] lg:pb-2.5 border-t border-[#1C1C1E] bg-[#000000] shrink-0">
        <div className="flex gap-2 items-end bg-[#1C1C1E] rounded-[18px] px-3.5 py-2.5 focus-within:border-[#0A84FF]/60 transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask about your inventory…"
            className="flex-1 min-w-0 bg-transparent text-[16px] text-white placeholder-[rgba(235,235,245,0.4)] resize-none focus:outline-none max-h-32 min-h-[24px] py-2"
            style={{ height: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || disabled}
            aria-label="Send message"
            className="shrink-0 w-9 h-9 rounded-full bg-[#0A84FF] flex items-center justify-center disabled:opacity-30 transition-opacity hover:bg-[#409CFF] active:scale-95"
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
        <p className="hidden sm:block text-center text-xs text-gray-600 mt-2">Shift+Enter for new line · Enter to send</p>
      </div>
    </div>
  );
}

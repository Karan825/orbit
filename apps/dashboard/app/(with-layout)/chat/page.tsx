'use client';

import { useEffect, useState, useRef } from 'react';
import { useHeaderContext } from '@/app/providers/header-provider';
import { ChatMessage, ChatToolCall } from '@/types/mcp-gateway';
import {
  MessageSquare as ChatIcon,
  CheckCircle2 as CheckIcon,
  AlertCircle as AlertCircleIcon,
  Send as SendIcon,
  Plus as PlusIcon,
  Cpu as CpuIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

export default function ChatPage() {
  const { setHeaderTitle, setHeaderContent } = useHeaderContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHeaderTitle('AI Assistant');
    setHeaderContent(null);
  }, [setHeaderTitle, setHeaderContent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const toggleToolExpand = (key: string) => {
    setExpandedTools((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNewChat = () => {
    setMessages([]);
    setExpandedTools({});
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || sending) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: 'sess-1',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sessionId: 'sess-1',
        role: 'assistant',
        content: data.answer || data.reply || data.content || 'Completed.',
        toolCalls: data.toolCalls || [],
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sessionId: 'sess-1',
        role: 'assistant',
        content: `Unable to complete chat request: ${err.message}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] rounded-2xl border border-[#E2E4F0] bg-white shadow-xs overflow-hidden">
      {/* Left Chat Sessions Sidebar */}
      <div className="hidden w-64 border-r border-[#E2E4F0] bg-[#F8F9FD] p-4 md:flex md:flex-col md:justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1E2038] uppercase tracking-wider">
              Chat Sessions
            </span>
            <button
              onClick={handleNewChat}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D5D8EB] bg-white text-[#55597D] hover:bg-[#EEF0FF] hover:text-[#5356FB] transition-colors"
              title="Start New Chat"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>

          <div
            onClick={handleNewChat}
            className="flex items-center gap-2.5 rounded-xl bg-white border border-[#5356FB]/30 p-2.5 shadow-2xs cursor-pointer text-xs font-semibold text-[#1E2038]"
          >
            <ChatIcon className="h-4 w-4 text-[#5356FB]" />
            <span className="truncate">Active Session</span>
          </div>
        </div>

        <div className="border-t border-[#E2E4F0] pt-3 text-[11px] text-[#55597D]">
          Logged in as: <span className="font-semibold text-[#1E2038]">Alice (Admin)</span>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#F4F5FF]">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5356FB] text-white shadow-xs mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#1E2038]">AI Assistant</h3>
              <p className="mt-1 max-w-md text-xs text-[#55597D] leading-relaxed">
                Manage orders, products, and fulfillment via your connected tools
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                <button
                  onClick={() => handleSend('What orders came in today?')}
                  className="rounded-xl border border-[#E2E4F0] bg-white px-3.5 py-2 text-xs font-medium text-[#1E2038] hover:border-[#5356FB] hover:text-[#5356FB] shadow-2xs transition-all"
                >
                  📦 "What orders came in today?"
                </button>
                <button
                  onClick={() => handleSend('Create product: Blue Mug at 499')}
                  className="rounded-xl border border-[#E2E4F0] bg-white px-3.5 py-2 text-xs font-medium text-[#1E2038] hover:border-[#5356FB] hover:text-[#5356FB] shadow-2xs transition-all"
                >
                  ☕ "Create product: Blue Mug at 499"
                </button>
                <button
                  onClick={() => handleSend('Get shipping quote for India, 560001')}
                  className="rounded-xl border border-[#E2E4F0] bg-white px-3.5 py-2 text-xs font-medium text-[#1E2038] hover:border-[#5356FB] hover:text-[#5356FB] shadow-2xs transition-all"
                >
                  🚚 "Get shipping quote for India, 560001"
                </button>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-[11px] text-[#55597D]">
                  <span className="font-semibold text-[#1E2038]">
                    {m.role === 'user' ? 'You' : 'MCP Agent'}
                  </span>
                  <span>•</span>
                  <span suppressHydrationWarning>{new Date(m.createdAt).toLocaleTimeString()}</span>
                </div>

                {/* Tool Execution Cards */}
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="w-full max-w-2xl mb-3 space-y-2">
                    {m.toolCalls.map((tc, idx) => {
                      const toolKey = `${m.id}-${idx}`;
                      const isExpanded = expandedTools[toolKey];

                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-[#E2E4F0] bg-white p-3.5 shadow-xs text-xs"
                        >
                          <div
                            onClick={() => toggleToolExpand(toolKey)}
                            className="flex cursor-pointer items-center justify-between font-mono"
                          >
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded bg-[#EEF0FF] text-[#5356FB]">
                                <CpuIcon className="h-3.5 w-3.5" />
                              </span>
                              <span className="font-bold text-[#1E2038]">
                                {tc.exposedName}
                              </span>
                              <span className="text-[10px] text-[#55597D]">
                                ({tc.server})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-medium text-[#15803D] border border-[#DCFCE7]">
                                <CheckIcon className="h-3 w-3 mr-1" />
                                {tc.durationMs}ms
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-[#55597D]" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-[#55597D]" />
                              )}
                            </div>
                          </div>

                          {/* Collapsible Tool Call Inspection Details */}
                          {isExpanded && (
                            <div className="mt-3 border-t border-[#E2E4F0] pt-3 space-y-2 font-mono text-[11px]">
                              {tc.input && (
                                <div>
                                  <span className="text-[10px] text-[#55597D] uppercase font-bold tracking-wider">
                                    Arguments:
                                  </span>
                                  <pre className="mt-1 rounded-lg bg-[#F8F9FD] border border-[#E2E4F0] p-2.5 text-[#1E2038] overflow-x-auto">
                                    {JSON.stringify(tc.input, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {tc.output && (
                                <div>
                                  <span className="text-[10px] text-[#55597D] uppercase font-bold tracking-wider">
                                    Response Payload:
                                  </span>
                                  <pre className="mt-1 rounded-lg bg-[#F8F9FD] border border-[#E2E4F0] p-2.5 text-[#1E2038] overflow-x-auto">
                                    {JSON.stringify(tc.output, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Text Message Bubble */}
                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3 text-sm shadow-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#5356FB] text-white font-medium'
                      : 'border border-[#E2E4F0] bg-white text-[#1E2038]'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-[#55597D] font-mono">
              <CpuIcon className="h-4 w-4 text-[#5356FB]" />
              Agent running tool loop via GatewayService...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips (when messages exist) */}
        {messages.length > 0 && (
          <div className="flex flex-wrap gap-2 px-6 pb-2">
            <button
              onClick={() => handleSend('What orders came in today?')}
              className="rounded-full border border-[#D5D8EB] bg-white px-3 py-1 text-xs text-[#55597D] hover:border-[#5356FB] hover:text-[#5356FB] transition-colors shadow-2xs"
            >
              📦 "What orders came in today?"
            </button>
            <button
              onClick={() => handleSend('Create product: Blue Mug at 499')}
              className="rounded-full border border-[#D5D8EB] bg-white px-3 py-1 text-xs text-[#55597D] hover:border-[#5356FB] hover:text-[#5356FB] transition-colors shadow-2xs"
            >
              ☕ "Create product: Blue Mug at 499"
            </button>
            <button
              onClick={() => handleSend('Get shipping quote for India, 560001')}
              className="rounded-full border border-[#D5D8EB] bg-white px-3 py-1 text-xs text-[#55597D] hover:border-[#5356FB] hover:text-[#5356FB] transition-colors shadow-2xs"
            >
              🚚 "Get shipping quote for India, 560001"
            </button>
          </div>
        )}

        {/* Bottom Input Box */}
        <div className="border-t border-[#E2E4F0] p-4 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3"
          >
            <input
              type="text"
              placeholder="Ask the MCP agent to interact with WooCommerce or connected upstreams..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-xl border border-[#D5D8EB] bg-[#F8F9FD] px-4 py-2.5 text-sm text-[#1E2038] placeholder-[#8E92BC] focus:bg-white focus:outline-none focus:border-[#5356FB] shadow-2xs transition-all"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5356FB] text-white shadow-sm hover:bg-[#4346E8] disabled:opacity-50 transition-colors"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

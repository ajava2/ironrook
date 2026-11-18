import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCoachSystemPrompt,
  localDinnerAdvice,
  localLegAnalysis,
  localShoulderSwap,
  type CoachSnapshot,
} from '../../core/coach';
import { addDays, today } from '../../core/dates';
import { uid } from '../../core/id';
import type { BodyWeight, ChatMessage, Favorite, Workout } from '../../core/types';
import { EXERCISE_MAP, SHOULDER_SAFE_SWAPS, TEMPLATES } from '../../data/catalog';
import type { AIMessage } from '../../services/ai';
import { useAppData, useQuery } from '../../state/AppData';
import { useAISettings } from '../../state/useAISettings';
import { useDaySummary } from '../../state/useDaySummary';
import { IconSend, IconTrash } from '../../ui/icons';
import { Markdown } from '../../ui/Markdown';
import { Sheet } from '../../ui/Sheet';
import './coach.css';

type Intent = { kind: 'dinner' } | { kind: 'legs' } | { kind: 'swap'; exerciseId: string } | { kind: 'free' };

const HISTORY_WINDOW = 12;

export function CoachView() {
  const { repo, profile, toast } = useAppData();
  const { client } = useAISettings();
  const date = today();
  const day = useDaySummary(date);
  const favorites = useQuery((r) => r.allFavorites(), [], [] as Favorite[]);
  const recentWorkouts = useQuery((r) => r.workoutsBetween(addDays(date, -35), date), [date], [] as Workout[]);
  const weights = useQuery((r) => r.allWeights(), [], [] as BodyWeight[]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [swapPicker, setSwapPicker] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController>(null);

  useEffect(() => {
    repo.chatHistory().then(setMessages);
  }, [repo]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  const snapshot: CoachSnapshot = useMemo(
    () => ({ date, profile, day, mealsToday: day.meals, recentWorkouts, weights, favorites }),
    [date, profile, day, recentWorkouts, weights, favorites],
  );
  const systemPrompt = useMemo(() => buildCoachSystemPrompt(snapshot, EXERCISE_MAP), [snapshot]);

  const push = async (m: ChatMessage) => {
    setMessages((list) => [...list, m]);
    await repo.saveChatMessage(m);
  };

  const localAnswer = (intent: Intent): string => {
    switch (intent.kind) {
      case 'dinner':
        return localDinnerAdvice(snapshot);
      case 'legs':
        return localLegAnalysis(snapshot, EXERCISE_MAP);
      case 'swap':
        return localShoulderSwap(intent.exerciseId, EXERCISE_MAP, SHOULDER_SAFE_SWAPS);
      case 'free':
        return [
          'Estoy en **modo local** (sin IA conectada), así que solo sé responder a las consultas rápidas de arriba.',
          '',
          'Para chatear libremente, pega tu API key gratuita de Google AI Studio en Ajustes ⚙ (o configura Groq / Ollama).',
        ].join('\n');
    }
  };

  const send = async (text: string, intent: Intent = { kind: 'free' }) => {
    const content = text.trim();
    if (!content || pending) return;
    setInput('');
    const userMsg: ChatMessage = { id: uid('c'), role: 'user', content, createdAt: Date.now() };
    await push(userMsg);

    if (!client) {
      await push({ id: uid('c'), role: 'assistant', content: localAnswer(intent), createdAt: Date.now() + 1 });
      return;
    }

    setPending(true);
    abortRef.current = new AbortController();
    try {
      const history: AIMessage[] = [...messages, userMsg]
        .slice(-HISTORY_WINDOW)
        .map((m) => ({ role: m.role, content: m.content }));
      const reply = await client.chat([{ role: 'system', content: systemPrompt }, ...history], abortRef.current.signal);
      await push({ id: uid('c'), role: 'assistant', content: reply.trim(), createdAt: Date.now() });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : String(e);
      toast(msg, 'error');
      await push({
        id: uid('c'),
        role: 'assistant',
        content: `No pude contactar con ${client.label} (${msg}). Respuesta local:\n\n${localAnswer(intent)}`,
        createdAt: Date.now(),
      });
    } finally {
      setPending(false);
    }
  };

  const swapCandidates = TEMPLATES.flatMap((t) => t.exercises.map((e) => e.exerciseId)).filter(
    (id, i, arr) => arr.indexOf(id) === i && id in SHOULDER_SAFE_SWAPS,
  );

  return (
    <>
      <div className="card spread" style={{ padding: '10px 14px' }}>
        <span className="provider-pill small">
          <span className={`dot${client ? '' : ' sim'}`} />
          {client ? client.label : 'Coach local (sin IA)'}
        </span>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowContext((v) => !v)}>
            {showContext ? 'Ocultar' : 'Contexto'}
          </button>
          {messages.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              aria-label="Borrar conversación"
              onClick={async () => {
                abortRef.current?.abort();
                await repo.clearChat();
                setMessages([]);
              }}
            >
              <IconTrash size={16} />
            </button>
          )}
        </div>
      </div>
      {showContext && (
        <div className="card">
          <div className="small muted">Esto es lo que se inyecta como prompt de sistema en cada mensaje:</div>
          <div className="context-box">{systemPrompt}</div>
        </div>
      )}

      <div className="quick-prompts">
        <button onClick={() => void send('¿Qué ceno hoy con lo que me falta de macros?', { kind: 'dinner' })}>
          🥖 ¿Qué ceno hoy con lo que me falta de macros?
          <div className="small faint num">
            Faltan {day.remaining.kcal} kcal · {Math.round(day.remaining.protein)} g proteína
          </div>
        </button>
        <button onClick={() => void send('Analiza mi progresión de pierna de este mes', { kind: 'legs' })}>
          🦵 Analiza mi progresión de pierna de este mes
        </button>
        <button onClick={() => setSwapPicker(true)}>🛡 Sustituye este ejercicio por uno que no cargue el hombro</button>
      </div>

      <div className="chat">
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
          </div>
        ))}
        {pending && (
          <div className="bubble assistant row">
            <div className="spinner" /> Pensando…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          rows={1}
          placeholder={client ? 'Pregunta a tu coach…' : 'Configura la IA en Ajustes para chat libre'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={!input.trim() || pending} aria-label="Enviar">
          <IconSend size={18} />
        </button>
      </form>

      {swapPicker && (
        <Sheet title="¿Qué ejercicio quieres sustituir?" onClose={() => setSwapPicker(false)}>
          <div className="picker-list">
            {swapCandidates.map((id) => {
              const e = EXERCISE_MAP.get(id)!;
              return (
                <button
                  key={id}
                  className="picker-item"
                  onClick={() => {
                    setSwapPicker(false);
                    void send(`Sustituye ${e.name} por un ejercicio que no cargue el hombro`, { kind: 'swap', exerciseId: id });
                  }}
                >
                  <span style={{ fontWeight: 650 }}>{e.name}</span>
                  {!e.shoulderFriendly && <span className="chip chip-amber">carga hombro</span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}

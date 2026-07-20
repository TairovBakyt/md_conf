import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../authorization/UserContext';
import { API_URL } from '../config';
import { IconChat, IconTrash, IconPencil, IconSend, IconPlay, IconPause, IconPaperclip, IconCamera, IconMic } from './icons';

const TAP_THRESHOLD_MS = 300;
const SWIPE_CANCEL_PX = 80;

const EMOJI_LIST = ['😀', '😂', '😍', '👍', '🙏', '🎉', '❤️', '😢', '😮', '🤔', '👋', '🔥'];

function renderMessageText(text: string): React.ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i): React.ReactNode =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-mc-gold hover:text-yellow-200 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ: FaqItem[] = [
  { question: 'Как начисляются баллы?', answer: 'За прохождение каждой станции квеста — подробности смотри в разделе «Станции квеста» ниже на этой странице.' },
  { question: 'Как получить приз?', answer: 'Набери баллы, зайди в «Магазин призов» и выбери подарок — администратор выдаст его на стойке.' },
  { question: 'Я забыл, на каких станциях уже был', answer: 'Смотри блок «Прогресс по станциям» на этой странице — там отмечено, что уже пройдено.' },
  { question: 'Что-то не работает в приложении', answer: 'Попробуй обновить страницу. Если не помогло — напиши администратору ниже.' },
];

interface ChatMessage {
  id: number;
  sender: 'participant' | 'admin';
  message: string | null;
  attachment_type: string | null;
  attachment_data: string | null;
  created_at: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Черновик недописанного сообщения — переживает F5 и переключение вкладок,
// как в ChatInbox (там на каждого собеседника отдельно, здесь собеседник
// всегда один — администратор — поэтому ключ по своему userId).
const DRAFT_KEY_PREFIX = 'helpbot_draft_';

function loadDraft(userId: string): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY_PREFIX + userId) ?? '';
  } catch {
    return '';
  }
}

function saveDraft(userId: string, text: string) {
  try {
    if (text) sessionStorage.setItem(DRAFT_KEY_PREFIX + userId, text);
    else sessionStorage.removeItem(DRAFT_KEY_PREFIX + userId);
  } catch {
    // не критично
  }
}

export const HelpBot: React.FC = () => {
  const { user } = useUser();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLocked, setRecordLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordError, setRecordError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [revealedId, setRevealedId] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unreadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const micPressStartRef = useRef(0);
  const micPressXRef = useRef(0);
  const micPressYRef = useRef(0);
  const recordCancelledRef = useRef(false);

  // Guards against out-of-order responses: a poll tick that started
  // before a hide/delete finished can resolve *after* the deliberate
  // refetch and silently resurrect a just-removed message. Only the
  // response from the most recently issued request is ever applied.
  const fetchSeqRef = useRef(0);
  // Messages the user just hid locally — filtered out of every render
  // even if a stale in-flight response briefly includes them again.
  const locallyHiddenRef = useRef<Set<number>>(new Set());

  // Счётчик непрочитанных от админа — работает независимо от того,
  // открыт ли чат, чтобы показывать бейдж прямо на свёрнутой кнопке.
  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/chat/unread-count/${user.id}`);
      const data = await res.json();
      if (res.ok) setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    unreadPollRef.current = setInterval(fetchUnreadCount, 5000);
    return () => {
      if (unreadPollRef.current) clearInterval(unreadPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchMessages = async () => {
    if (!user) return;
    const seq = ++fetchSeqRef.current;
    try {
      const res = await fetch(`${API_URL}/api/chat/participant/${user.id}`);
      const data = await res.json();
      if (seq !== fetchSeqRef.current) return; // a newer request already resolved, ignore this stale one
      if (res.ok) {
        const filtered = (data as ChatMessage[]).filter((m) => !locallyHiddenRef.current.has(m.id));
        setMessages(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markReadAsParticipant = async () => {
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/chat/mark-read-participant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!showChat || !user) return;
    setInput(loadDraft(user.id));
    fetchMessages();
    markReadAsParticipant();
    pollRef.current = setInterval(() => {
      fetchMessages();
      markReadAsParticipant();
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChat]);

  // Останавливаем запись при закрытии чата/размонтировании — иначе
  // микрофон продолжает работать в фоне.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        recordCancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  // Автопрокрутка к последнему сообщению — только если пользователь и так
  // был внизу (или это первое открытие чата). Прокручиваем scrollTop
  // контейнера сообщений (не scrollIntoView), чтобы не утаскивать вниз
  // всю страницу дашборда целиком.
  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  };

  const sendMessage = async (text: string | null, attachmentType?: string, attachmentData?: string) => {
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          sender: 'participant',
          message: text,
          attachmentType: attachmentType || null,
          attachmentData: attachmentData || null,
        }),
      });
      fetchMessages();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    const text = input.trim();
    setInput('');
    saveDraft(user.id, '');
    await sendMessage(text);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith('video') ? 'video' : 'image';
    const previewUrl = URL.createObjectURL(file);
    setUploadPreview({ url: previewUrl, type });
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      await sendMessage(null, type, base64);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      setUploadPreview(null);
      URL.revokeObjectURL(previewUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const getSupportedMimeType = (): string => {
    const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  // Запись голосового — WhatsApp/Telegram-стиль: долгое нажатие на 🎤
  // записывает, пока держите палец, отпустили — автоотправка; короткий
  // тап "фиксирует" запись в отдельном режиме с Пауза/Возобновить,
  // 🗑 Отмена и ➤ Отправить (см. handleMicPointerUp).
  const startRecording = async () => {
    setRecordError('');
    recordCancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        stream.getTracks().forEach((t) => t.stop());

        if (recordCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        if (audioChunksRef.current.length === 0) {
          setRecordError('Запись не удалась, попробуйте ещё раз');
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          sendMessage(null, 'audio', reader.result as string);
        };
        reader.onerror = () => setRecordError('Не удалось обработать запись');
        reader.readAsDataURL(blob);
      };
      recorder.onerror = () => {
        setRecordError('Ошибка записи');
        setIsRecording(false);
        setRecordLocked(false);
        setIsPaused(false);
      };

      recorder.start();
      setIsRecording(true);
      setRecordLocked(false);
      setIsPaused(false);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      setRecordError('Нет доступа к микрофону');
    }
  };

  // Отпустили кнопку 🎤 — либо отправляем (долгое удержание), либо
  // переходим в зафиксированный режим (короткий тап).
  const handleMicPointerUp = () => {
    if (!isRecording || recordLocked) return;
    const held = micPressStartRef.current === 0
      ? 0
      : Date.now() - micPressStartRef.current;
    if (held < TAP_THRESHOLD_MS) {
      setTimeout(() => setRecordLocked(true), 50);
    } else {
      stopRecording();
    }
  };

  const handleMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isRecording) return;
    micPressStartRef.current = Date.now();
    micPressXRef.current = e.clientX;
    micPressYRef.current = e.clientY;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // не критично — на некоторых браузерах может отсутствовать
    }
    e.preventDefault();
    startRecording();
  };

  // Провели пальцем влево во время удержания — отменяет запись; вверх —
  // блокирует запись (фиксирует в режиме с Паузой/Отменой/Отправить).
  const handleMicPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isRecording || recordLocked) return;

    const deltaX = micPressXRef.current - e.clientX;
    if (deltaX > SWIPE_CANCEL_PX) {
      handleCancelRecording();
      return;
    }

    const deltaY = micPressYRef.current - e.clientY;
    if (deltaY > SWIPE_CANCEL_PX) {
      setRecordLocked(true);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordLocked(false);
    setIsPaused(false);
  };

  const handleCancelRecording = () => {
    recordCancelledRef.current = true;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordLocked(false);
    setIsPaused(false);
    setRecordingSeconds(0);
  };

  const handlePauseResume = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (isPaused) {
      recorder.resume();
      setIsPaused(false);
      recordingIntervalRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } else {
      recorder.pause();
      setIsPaused(true);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDeleteMessage = async (m: ChatMessage) => {
    if (m.sender === 'admin') {
      if (!confirm('Скрыть это сообщение у себя? Администратор продолжит видеть его как обычно.')) return;

      locallyHiddenRef.current.add(m.id);
      setMessages((prev) => prev.filter((msg) => msg.id !== m.id));

      try {
        await fetch(`${API_URL}/api/chat/hide/${m.id}`, { method: 'POST' });
        fetchMessages();
      } catch (err) {
        console.error(err);
      }
    } else {
      if (!confirm('Удалить это сообщение?')) return;
      try {
        await fetch(`${API_URL}/api/chat/message/${m.id}`, { method: 'DELETE' });
        fetchMessages();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleStartEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditText(m.message || '');
    setRevealedId(null);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editText.trim()) return;
    try {
      await fetch(`${API_URL}/api/chat/message/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: editText.trim() }),
      });
      setEditingId(null);
      fetchMessages();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <h2 className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider mb-2">
        Помощь
      </h2>

      <div className="flex flex-col gap-2">
        {FAQ.map((item, i) => (
          <div key={i} className="pixel-tile overflow-hidden">
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full text-left px-3 py-2.5 text-mc-cream text-xs font-medium flex items-center justify-between"
            >
              {item.question}
              <span className="text-mc-cream/50 text-xs">{openFaq === i ? '−' : '+'}</span>
            </button>
            {openFaq === i && (
              <p className="px-3 pb-3 text-mc-cream/60 text-[10px] leading-relaxed">{item.answer}</p>
            )}
          </div>
        ))}
      </div>

      {!showChat ? (
        <button
          onClick={() => setShowChat(true)}
          className="pixel-btn relative w-full mt-3 bg-mc-wood text-mc-cream font-medium py-2.5 text-xs transition-colors flex items-center justify-center gap-2"
        >
          <IconChat className="w-4 h-4 shrink-0" /> Не нашли ответ? Написать администратору
          {unreadCount > 0 && (
            <span className="pixel-badge absolute -top-2 -right-2 bg-mc-redstone text-white text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <div className="pixel-panel mt-3 p-3 h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-mc-cream/50 text-[9px]">Переписка с администратором</span>
            <button onClick={() => setShowChat(false)} className="text-mc-cream/50 hover:text-mc-gold text-[10px]">
              Свернуть
            </button>
          </div>

          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="pixel-scroll flex flex-col gap-2 flex-1 overflow-y-auto mb-2"
          >
            {messages.length === 0 && (
              <p className="text-mc-cream/40 text-[10px] text-center py-2">Напишите свой вопрос ниже</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                onClick={() => setRevealedId(revealedId === m.id ? null : m.id)}
                className={`pixel-tile max-w-[80%] px-3 py-2 text-[10px] relative cursor-pointer ${
                  m.sender === 'participant'
                    ? 'bg-mc-emerald-dark text-white self-end'
                    : 'text-mc-cream self-start'
                }`}
              >
                {m.attachment_type === 'image' && (
                  <div
                    className="w-full h-48 rounded-lg mb-1 overflow-hidden cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); window.open(m.attachment_data!, '_blank'); }}
                  >
                    <img
                      src={m.attachment_data!}
                      alt="вложение"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {m.attachment_type === 'video' && (
                  <div className="rounded-lg mb-1 overflow-hidden" style={{ width: '100%', height: '192px' }}>
                    <video
                      src={m.attachment_data!}
                      controls
                      style={{ width: '100%', height: '192px', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                )}
                {m.attachment_type === 'audio' && (
                  <audio src={m.attachment_data!} controls className="max-w-full mb-1" />
                )}

                {editingId === m.id ? (
                  <div className="flex gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(m.id)}
                      className="flex-1 bg-mc-panel text-mc-cream text-[11px] px-2 py-1 outline-none border-2 border-black"
                      autoFocus
                    />
                    <button onClick={() => handleSaveEdit(m.id)} className="text-mc-emerald text-xs">✓</button>
                    <button onClick={() => setEditingId(null)} className="text-mc-cream/50 text-xs">✕</button>
                  </div>
                ) : (
                  m.message && <span>{renderMessageText(m.message)}</span>
                )}

                {revealedId === m.id && editingId !== m.id && (
                  <div
                    className="pixel-badge flex gap-2 absolute -top-2 right-1 bg-mc-panel px-1.5 py-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {m.sender === 'participant' && m.message && !m.attachment_type && (
                      <button onClick={() => handleStartEdit(m)} className="text-mc-cream/60 hover:text-mc-cream">
                        <IconPencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDeleteMessage(m)} className="text-mc-redstone hover:text-red-400">
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showEmoji && !recordLocked && (
            <div className="pixel-tile flex flex-wrap gap-1.5 mb-2 p-2 shrink-0">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setInput((prev) => prev + emoji)}
                  className="text-lg hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {recordLocked ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCancelRecording}
                className="pixel-btn bg-mc-panel-light hover:bg-mc-redstone text-mc-redstone hover:text-white px-3 py-2.5 shrink-0"
                title="Удалить запись"
              >
                <IconTrash className="w-4 h-4" />
              </button>
              <button
                onClick={handlePauseResume}
                className="pixel-btn flex-1 bg-mc-panel-light px-3 py-2.5 text-xs text-mc-cream flex items-center justify-center gap-2"
              >
                {isPaused ? <IconPlay className="w-4 h-4" /> : <IconPause className="w-4 h-4" />}
                {isPaused ? 'Возобновить' : 'Пауза'} · {formatDuration(recordingSeconds)}
              </button>
              <button
                onClick={stopRecording}
                className="pixel-btn bg-mc-emerald text-white w-10 h-10 flex items-center justify-center shrink-0"
                title="Отправить"
              >
                <IconSend className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="shrink-0">
              {isRecording && (
                <p className="text-mc-cream/50 text-[9px] text-center pb-1.5">
                  ↑ Вверх — блокировка · ← Влево — отмена · отпустите — отправить
                </p>
              )}
              <div className="flex items-center gap-2">
                <div className="pixel-tile flex-1 flex items-center gap-1.5 pl-3 pr-1.5 py-1 min-w-0">
                  <button
                    onClick={() => setShowEmoji((v) => !v)}
                    disabled={isRecording}
                    className="shrink-0 text-lg leading-none disabled:opacity-50"
                  >
                    😊
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (user) saveDraft(user.id, e.target.value);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    onFocus={() => setShowEmoji(false)}
                    placeholder="Ваш вопрос..."
                    disabled={isRecording}
                    className="flex-1 bg-transparent text-mc-cream text-xs outline-none min-w-0 py-2 disabled:opacity-50"
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || isRecording}
                    className="shrink-0 leading-none disabled:opacity-50"
                  >
                    <IconPaperclip className="w-4 h-4" />
                  </button>

                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploading || isRecording}
                    className="shrink-0 leading-none disabled:opacity-50 pr-1"
                  >
                    <IconCamera className="w-4 h-4" />
                  </button>
                </div>

                {input.trim() && !isRecording ? (
                  <button
                    onClick={handleSend}
                    className="pixel-btn bg-mc-emerald text-white w-11 h-11 flex items-center justify-center shrink-0"
                  >
                    <IconSend className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onPointerDown={handleMicPointerDown}
                    onPointerUp={handleMicPointerUp}
                    onPointerCancel={handleMicPointerUp}
                    onPointerMove={handleMicPointerMove}
                    onTouchStart={(e) => e.preventDefault()}
                    className={`pixel-btn w-11 h-11 flex items-center justify-center shrink-0 select-none ${
                      isRecording
                        ? 'bg-mc-redstone text-white text-xs font-mono'
                        : 'bg-mc-panel-light text-mc-cream'
                    }`}
                  >
                    {isRecording ? formatDuration(recordingSeconds) : <IconMic className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </div>
          )}
          {recordError && <p className="text-mc-redstone text-[10px] mt-1 shrink-0">{recordError}</p>}

          {uploadPreview && (
            <div className="relative mt-2 shrink-0 inline-block">
              {uploadPreview.type === 'image' ? (
                <img src={uploadPreview.url} alt="превью" className="max-h-40 opacity-20" />
              ) : (
                <video src={uploadPreview.url} className="max-h-40 opacity-20" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HelpBot;
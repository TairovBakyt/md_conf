import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../authorization/UserContext';
import { API_URL } from '../config';

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
        className="underline text-cyan-300 hover:text-cyan-200 break-all"
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

export const HelpBot: React.FC = () => {
  const { user } = useUser();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordError, setRecordError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [revealedId, setRevealedId] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guards against out-of-order responses: a poll tick that started
  // before a hide/delete finished can resolve *after* the deliberate
  // refetch and silently resurrect a just-removed message. Only the
  // response from the most recently issued request is ever applied.
  const fetchSeqRef = useRef(0);
  // Messages the user just hid locally — filtered out of every render
  // even if a stale in-flight response briefly includes them again.
  const locallyHiddenRef = useRef<Set<number>>(new Set());

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

  useEffect(() => {
    if (!showChat) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChat]);

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
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const type = file.type.startsWith('video') ? 'video' : 'image';
      await sendMessage(null, type, base64);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getSupportedMimeType = (): string => {
    const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  const startRecording = async () => {
    setRecordError('');
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
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      setRecordError('Нет доступа к микрофону');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
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
      <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
        Помощь
      </h2>

      <div className="flex flex-col gap-2">
        {FAQ.map((item, i) => (
          <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full text-left px-3 py-2.5 text-slate-100 text-sm font-medium flex items-center justify-between"
            >
              {item.question}
              <span className="text-slate-500 text-xs">{openFaq === i ? '−' : '+'}</span>
            </button>
            {openFaq === i && (
              <p className="px-3 pb-3 text-slate-400 text-xs leading-relaxed">{item.answer}</p>
            )}
          </div>
        ))}
      </div>

      {!showChat ? (
        <button
          onClick={() => setShowChat(true)}
          className="w-full mt-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl py-2.5 text-sm transition-colors"
        >
          💬 Не нашли ответ? Написать администратору
        </button>
      ) : (
        <div className="mt-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto mb-2">
            {messages.length === 0 && (
              <p className="text-slate-600 text-xs text-center py-2">Напишите свой вопрос ниже</p>
            )}
            {messages.map((m) => (
            <div
                key={m.id}
                onClick={() => setRevealedId(revealedId === m.id ? null : m.id)}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-xs relative cursor-pointer ${
                m.sender === 'participant'
                    ? 'bg-indigo-600 text-white self-end'
                    : 'bg-slate-800 text-slate-200 self-start'
                }`}
            >
                {m.attachment_type === 'image' && (
                  <img src={m.attachment_data!} alt="вложение" className="rounded-lg max-w-full mb-1" />
                )}
                {m.attachment_type === 'video' && (
                  <video src={m.attachment_data!} controls className="rounded-lg max-w-full mb-1" />
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
                      className="flex-1 bg-slate-900 text-slate-100 text-[11px] rounded px-2 py-1 outline-none"
                      autoFocus
                    />
                    <button onClick={() => handleSaveEdit(m.id)} className="text-emerald-400 text-xs">✓</button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400 text-xs">✕</button>
                  </div>
                ) : (
                  m.message && <span>{renderMessageText(m.message)}</span>
                )}

                {revealedId === m.id && editingId !== m.id && (
                <div
                    className="flex gap-2 absolute -top-2 right-1 bg-slate-950 rounded px-1.5 py-0.5"
                    onClick={(e) => e.stopPropagation()}
                >
                    {m.sender === 'participant' && m.message && !m.attachment_type && (
                    <button onClick={() => handleStartEdit(m)} className="text-slate-400 hover:text-slate-200 text-xs">
                        ✎
                    </button>
                    )}
                    <button onClick={() => handleDeleteMessage(m)} className="text-red-400 hover:text-red-300 text-xs">
                    🗑
                    </button>
                </div>
                )}
                            </div>
            ))}
          </div>

          {showEmoji && (
            <div className="flex flex-wrap gap-1.5 mb-2 bg-slate-800 rounded-lg p-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setInput((prev) => prev + emoji);
                    setShowEmoji(false);
                  }}
                  className="text-lg hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1.5">
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className="bg-slate-800 hover:bg-slate-700 rounded-lg px-2 py-2 text-sm transition-colors shrink-0"
            >
              😊
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-slate-800 hover:bg-slate-700 rounded-lg px-2 py-2 text-sm transition-colors shrink-0 disabled:opacity-50"
            >
              📎
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
              disabled={uploading}
              className="bg-slate-800 hover:bg-slate-700 rounded-lg px-2.5 py-2.5 text-sm transition-colors shrink-0 disabled:opacity-50"
            >
              📸
            </button>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`rounded-lg px-2.5 py-2.5 text-xs font-mono font-medium transition-colors shrink-0 ${
                isRecording ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              {isRecording ? `⏹️ ${formatDuration(recordingSeconds)}` : '🎤'}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ваш вопрос..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs outline-none focus:border-indigo-500 min-w-0"
            />
            <button
              onClick={handleSend}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors shrink-0"
            >
              →
            </button>
          </div>
          {recordError && <p className="text-red-400 text-xs mt-1">{recordError}</p>}
          {uploading && <p className="text-slate-500 text-[10px] mt-1">Загружаем файл...</p>}
        </div>
      )}
    </div>
  );
};

export default HelpBot;
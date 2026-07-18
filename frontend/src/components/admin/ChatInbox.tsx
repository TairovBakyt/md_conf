import React, { useEffect, useRef, useState } from 'react';
import { API_URL } from '../../config';

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

interface InboxItem {
  userId: string;
  username: string;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
}

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

export const ChatInbox: React.FC = () => {
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [selected, setSelected] = useState<InboxItem | null>(null);
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

  // Защита от старых ответов (seq) и локальный буфер скрытых сообщений
  const fetchSeqRef = useRef(0);
  const locallyHiddenRef = useRef<Set<number>>(new Set());

  const fetchInbox = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/admin/inbox`);
      const data = await res.json();
      if (res.ok) setInbox(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 5000);
    return () => clearInterval(interval);
  }, []);

  // ИЗМЕНЕНО ПО ПЛАНУ КЛОДА: Запрашиваем админскую ветку без скрытых сообщений
  const fetchThread = async (userId: string) => {
    const seq = ++fetchSeqRef.current;
    try {
      const res = await fetch(`${API_URL}/api/chat/admin-thread/${userId}`);
      const data = await res.json();
      if (seq !== fetchSeqRef.current) return; // игнорируем устаревший ответ
      if (res.ok) {
        const filtered = (data as ChatMessage[]).filter((m) => !locallyHiddenRef.current.has(m.id));
        setMessages(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openChat = async (item: InboxItem) => {
    setSelected(item);
    locallyHiddenRef.current.clear();
    await fetchThread(item.userId);
    try {
      await fetch(`${API_URL}/api/chat/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: item.userId }),
      });
      fetchInbox();
    } catch (err) {
      console.error(err);
    }

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchThread(item.userId), 3000);
  };

  const sendMessage = async (text: string | null, attachmentType?: string, attachmentData?: string) => {
    if (!selected) return;
    try {
      await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selected.userId,
          sender: 'admin',
          message: text,
          attachmentType: attachmentType || null,
          attachmentData: attachmentData || null,
        }),
      });
      fetchThread(selected.userId);
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

  // ИЗМЕНЕНО ПО ПЛАНУ КЛОДА: Разделение удаления и скрытия сообщений
  const handleDeleteMessage = async (m: ChatMessage) => {
    if (m.sender === 'participant') {
      // Чужое сообщение участника скрываем ТОЛЬКО у админа
      if (!confirm('Скрыть это сообщение у себя? Участник продолжит видеть его.')) return;

      locallyHiddenRef.current.add(m.id);
      setMessages((prev) => prev.filter((msg) => msg.id !== m.id));

      try {
        // Стучимся на роут скрытия у админа
        await fetch(`${API_URL}/api/chat/hide-admin/${m.id}`, { method: 'POST' });
        if (selected) fetchThread(selected.userId);
      } catch (err) {
        console.error(err);
      }
    } else {
      // Своё сообщение админа удаляем полностью для всех из БД
      if (!confirm('Удалить это сообщение для всех?')) return;
      try {
        await fetch(`${API_URL}/api/chat/message/${m.id}`, { method: 'DELETE' });
        if (selected) fetchThread(selected.userId);
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
      if (selected) fetchThread(selected.userId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteThread = async () => {
    if (!selected) return;
    if (!confirm(`Удалить всю переписку с ${selected.username}? Это необратимо.`)) return;
    try {
      await fetch(`${API_URL}/api/chat/thread/${selected.userId}`, { method: 'DELETE' });
      setSelected(null);
      if (pollRef.current) clearInterval(pollRef.current);
      fetchInbox();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteThreadFromList = async (userId: string, username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Удалить всю переписку с ${username}? Это необратимо.`)) return;
    try {
      await fetch(`${API_URL}/api/chat/thread/${userId}`, { method: 'DELETE' });
      fetchInbox();
    } catch (err) {
      console.error(err);
    }
  };

  if (selected) {
    const othersWithUnread = inbox.filter(
      (item) => item.userId !== selected.userId && item.unreadCount > 0
    );
    const otherUnread = othersWithUnread.reduce((sum, item) => sum + item.unreadCount, 0);
    const latestOther = othersWithUnread.sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    )[0];

    return (
      <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-indigo-400">{selected.username}</span>
          <div className="flex items-center gap-3">
            <button onClick={handleDeleteThread} className="text-red-400 text-xs hover:text-red-300">
              Удалить чат
            </button>
            <button onClick={() => { setSelected(null); if (pollRef.current) clearInterval(pollRef.current); }} className="text-slate-500 text-xs hover:text-slate-300">
              ← Назад
            </button>
          </div>
        </div>

        {latestOther && (
          <button
            onClick={() => openChat(latestOther)}
            className="w-full mb-3 bg-amber-600/20 border border-amber-600/50 rounded-lg py-2.5 px-3 text-left hover:bg-amber-600/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-amber-400 text-xs font-semibold">🔔 {latestOther.username}</span>
              {otherUnread > 1 && (
                <span className="text-amber-500 text-[10px]">+{otherUnread - 1} ещё</span>
              )}
            </div>
            <p className="text-amber-300/80 text-xs truncate">{latestOther.lastMessage}</p>
          </button>
        )}

        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto mb-3">
          {messages.map((m) => (
            <div
              key={m.id}
              onClick={() => setRevealedId(revealedId === m.id ? null : m.id)}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm relative cursor-pointer ${
                m.sender === 'admin'
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
                    className="flex-1 bg-slate-900 text-slate-100 text-xs rounded px-2 py-1 outline-none"
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
                  {/* ИЗМЕНЕНО ПО ПЛАНУ КЛОДА: Кнопка редактирования только у своих (admin) сообщений */}
                  {m.sender === 'admin' && m.message && !m.attachment_type && (
                    <button onClick={() => handleStartEdit(m)} className="text-slate-400 hover:text-slate-200 text-xs">
                      ✎
                    </button>
                  )}
                  {/* Кнопка удаления (🗑) доступна всегда (разруливается клик-функцией) */}
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
            className="bg-slate-800 hover:bg-slate-700 rounded-lg px-2.5 py-2.5 text-sm transition-colors shrink-0"
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
            className="bg-slate-800 hover:bg-slate-700 rounded-lg px-2.5 py-2.5 text-sm transition-colors shrink-0 disabled:opacity-50"
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
            placeholder="Ответить..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500 min-w-0"
          />
          <button
            onClick={handleSend}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors shrink-0"
          >
            Отправить
          </button>
        </div>
        {recordError && <p className="text-red-400 text-xs mt-1">{recordError}</p>}
        {uploading && <p className="text-slate-500 text-xs mt-1">Загружаем файл...</p>}
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-indigo-400">Сообщения от участников</span>
      </div>

      {inbox.length === 0 && <p className="text-slate-600 text-xs text-center py-6">Пока сообщений нет</p>}

      <div className="flex flex-col gap-2">
        {inbox.map((item) => (
          <div
            key={item.userId}
            onClick={() => openChat(item)}
            className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded-xl p-3 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="min-w-0 flex-1">
              <p className="text-slate-100 text-sm font-medium">{item.username}</p>
              <p className="text-slate-500 text-xs truncate">{item.lastMessage}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {item.unreadCount > 0 && (
                <span className="bg-indigo-600 text-white text-xs font-medium rounded-full px-2 py-0.5">
                  {item.unreadCount}
                </span>
              )}
              <button
                onClick={(e) => handleDeleteThreadFromList(item.userId, item.username, e)}
                className="text-red-400 hover:text-red-300 text-sm px-1"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatInbox;
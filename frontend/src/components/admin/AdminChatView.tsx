import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';
import { type AdminTabId } from '../../adminTabs';

const LONG_PRESS_MS = 550;
const TAP_THRESHOLD_MS = 200;

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AccessBadge({
  permissions,
  isMainAdmin,
}: {
  permissions: AdminTabId[] | null | undefined;
  isMainAdmin?: boolean;
}) {
  const isFull = !permissions;
  return (
    <span
      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
        isMainAdmin
          ? 'bg-purple-950/60 text-purple-300 border border-purple-500/30'
          : isFull
          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
          : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
      }`}
    >
      {isMainAdmin ? '👑 Главный' : isFull ? 'Полный' : 'Частичный'}
    </span>
  );
}

interface InboxItem {
  otherId: string;
  username: string;
  adminPermissions: AdminTabId[] | null;
  isMainAdmin?: boolean;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
}

interface AdminItem {
  id: string;
  username: string;
  admin_permissions: AdminTabId[] | null;
  is_main_admin?: boolean;
}

interface AdminMessage {
  id: number;
  sender_id: string;
  recipient_id: string;
  message: string | null;
  attachment_type: string | null;
  attachment_data: string | null;
  created_at: string;
}

type View = 'list' | 'newChat' | 'thread';

// Какой экран/собеседник был открыт — переживает F5.
const ADMINCHAT_STORAGE_KEY = 'admin_adminchat_state';

interface PersistedAdminChatState {
  view: View;
  selectedOther: { id: string; username: string; adminPermissions: AdminTabId[] | null; isMainAdmin?: boolean } | null;
}

function loadPersistedAdminChatState(): PersistedAdminChatState {
  try {
    const raw = sessionStorage.getItem(ADMINCHAT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedAdminChatState;
  } catch {
    // не критично
  }
  return { view: 'list', selectedOther: null };
}

// Черновик недописанного сообщения — отдельно на каждого собеседника,
// переживает F5 и переключение между чатами.
const DRAFT_KEY_PREFIX = 'admin_adminchat_draft_';

function loadDraft(otherId: string): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY_PREFIX + otherId) ?? '';
  } catch {
    return '';
  }
}

function saveDraft(otherId: string, text: string) {
  try {
    if (text) sessionStorage.setItem(DRAFT_KEY_PREFIX + otherId, text);
    else sessionStorage.removeItem(DRAFT_KEY_PREFIX + otherId);
  } catch {
    // не критично
  }
}

export const AdminChatView: React.FC = () => {
  const { user } = useUser();
  const [persisted] = useState(loadPersistedAdminChatState);

  const [view, setView] = useState<View>(persisted.view);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [allAdmins, setAllAdmins] = useState<AdminItem[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [selectedOther, setSelectedOther] = useState<{ id: string; username: string; adminPermissions: AdminTabId[] | null; isMainAdmin?: boolean } | null>(
    persisted.selectedOther
  );
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLocked, setRecordLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordError, setRecordError] = useState('');
  const [revealedId, setRevealedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // Массовый выбор в списке диалогов
  const [listSelectionMode, setListSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());

  // Массовый выбор внутри открытой переписки
  const [msgSelectionMode, setMsgSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<number>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const inboxPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const threadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const micPressStartRef = useRef(0);
  const micPressXRef = useRef(0);
  const micPressYRef = useRef(0);
  const recordCancelledRef = useRef(false);
  const SWIPE_CANCEL_PX = 80;

  const EMOJI_LIST = ['😀', '😂', '👍', '🙏', '🎉', '❤️', '😢', '😮', '🤔', '👋', '🔥', '✅'];

  useEffect(() => {
    try {
      sessionStorage.setItem(ADMINCHAT_STORAGE_KEY, JSON.stringify({ view, selectedOther }));
    } catch {
      // не критично
    }
  }, [view, selectedOther]);

  // Останавливаем запись при размонтировании компонента (переключение чата,
  // смена вкладки) — иначе микрофон продолжает работать в фоне.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        recordCancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const fetchInbox = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/admin-chat/inbox/${user.id}`);
      const data = await res.json();
      if (res.ok) setInbox(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllAdmins = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/admin-chat/admins/${user.id}`);
      const data = await res.json();
      if (res.ok) setAllAdmins(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (view !== 'list' && view !== 'thread') return;
    fetchInbox();
    inboxPollRef.current = setInterval(fetchInbox, 5000);
    return () => {
      if (inboxPollRef.current) clearInterval(inboxPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Восстанавливаем список админов, если после F5 оказались на экране выбора собеседника
  useEffect(() => {
    if (view === 'newChat') fetchAllAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchThread = async (otherId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/admin-chat/thread/${user.id}/${otherId}`);
      const data = await res.json();
      if (res.ok) setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openThread = async (otherId: string, username: string, adminPermissions: AdminTabId[] | null, isMainAdmin?: boolean) => {
    setSelectedOther({ id: otherId, username, adminPermissions, isMainAdmin });
    setInput(loadDraft(otherId));
    shouldAutoScrollRef.current = true;
    setView('thread');
    setMsgSelectionMode(false);
    setSelectedMsgIds(new Set());
    await fetchThread(otherId);

    if (!user) return;
    try {
      await fetch(`${API_URL}/api/admin-chat/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selfId: user.id, otherId }),
      });
    } catch (err) {
      console.error(err);
    }

    if (threadPollRef.current) clearInterval(threadPollRef.current);
    threadPollRef.current = setInterval(() => fetchThread(otherId), 3000);
  };

  // Если после F5 оказались на экране треда — подтягиваем сообщения,
  // черновик и запускаем поллинг заново.
  useEffect(() => {
    if (view !== 'thread' || !selectedOther) return;
    setInput(loadDraft(selectedOther.id));
    fetchThread(selectedOther.id);
    if (threadPollRef.current) clearInterval(threadPollRef.current);
    threadPollRef.current = setInterval(() => fetchThread(selectedOther.id), 3000);
    return () => {
      if (threadPollRef.current) clearInterval(threadPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автопрокрутка к последнему сообщению — только если пользователь и так
  // был внизу (или это первое открытие треда). Если он вручную проскроллил
  // вверх читать историю, фоновый поллинг больше не сбрасывает его туда.
  // Прокручиваем именно scrollTop контейнера сообщений (не scrollIntoView),
  // чтобы не утаскивать вниз всю страницу целиком.
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

  const closeThread = () => {
    if (threadPollRef.current) clearInterval(threadPollRef.current);
    // Останавливаем запись если она была активна
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      recordCancelledRef.current = true;
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setRecordLocked(false);
    setIsPaused(false);
    setRecordingSeconds(0);
    setSelectedOther(null);
    setMessages([]);
    setRevealedId(null);
    setEditingId(null);
    setMsgSelectionMode(false);
    setSelectedMsgIds(new Set());
    setView('list');
  };

  const openNewChat = () => {
  fetchAllAdmins();
  setAdminSearchQuery('');
  setView('newChat');
};

  const sendMessage = async (text: string | null, attachmentType?: string, attachmentData?: string) => {
    if (!user || !selectedOther) return;
    try {
      await fetch(`${API_URL}/api/admin-chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          recipientId: selectedOther.id,
          message: text,
          attachmentType: attachmentType || null,
          attachmentData: attachmentData || null,
        }),
      });
      fetchThread(selectedOther.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedOther) return;
    const text = input.trim();
    setInput('');
    saveDraft(selectedOther.id, '');
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
    // Если micPressStartRef не был установлен (0) — считаем как короткий тап.
    const held = micPressStartRef.current === 0
      ? 0
      : Date.now() - micPressStartRef.current;
    if (held < TAP_THRESHOLD_MS) {
      setTimeout(() => setRecordLocked(true), 50);
    } else {
      stopRecording();
    }
  };
  const handleMicPointerCancel = () => {
    if (!isRecording || recordLocked) return;
    const held = micPressStartRef.current === 0
      ? 0
      : Date.now() - micPressStartRef.current;
    if (held < TAP_THRESHOLD_MS) {
      setTimeout(() => setRecordLocked(true), 50);
    }
  };

  

  // На мобильных браузерах pointercancel может прийти вместо pointerup
  // при быстром тапе. Обрабатываем его отдельно — если запись ещё не
  // зафиксирована (не locked), считаем это коротким тапом → фиксируем.


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
    // preventDefault предотвращает генерацию ghost click и pointercancel
    // на мобильных браузерах после быстрого tap.
    e.preventDefault();
    startRecording();
  };

  // Провели пальцем влево во время удержания — как в WhatsApp, отменяет
  // запись. setPointerCapture в handleMicPointerDown гарантирует, что это
  // событие продолжает приходить, даже если палец уходит за пределы кнопки.
  const handleMicPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isRecording || recordLocked) return;

    // Свайп влево — отменить запись (как раньше)
    const deltaX = micPressXRef.current - e.clientX;
    if (deltaX > SWIPE_CANCEL_PX) {
      handleCancelRecording();
      return;
    }

    // Свайп вверх — заблокировать запись (как в Telegram):
    // фиксируем запись в режиме с Паузой/Отменой/Отправить,
    // чтобы не держать палец.
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

  const handleDeleteOrHide = async (m: AdminMessage) => {
    if (!user || !selectedOther) return;
    const isMine = m.sender_id === user.id;

    if (isMine) {
      if (!confirm('Удалить это сообщение? Оно пропадёт у обеих сторон.')) return;
      try {
        await fetch(`${API_URL}/api/admin-chat/message/${m.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        fetchThread(selectedOther.id);
      } catch (err) {
        console.error(err);
      }
    } else {
      if (!confirm('Скрыть это сообщение у себя? Собеседник продолжит видеть его как обычно.')) return;
      try {
        await fetch(`${API_URL}/api/admin-chat/hide/${m.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewerId: user.id }),
        });
        fetchThread(selectedOther.id);
      } catch (err) {
        console.error(err);
      }
    }
    setRevealedId(null);
  };

  const handleStartEdit = (m: AdminMessage) => {
    setEditingId(m.id);
    setEditText(m.message || '');
    setRevealedId(null);
  };

  const handleSaveEdit = async (id: number) => {
    if (!user || !editText.trim()) return;
    try {
      await fetch(`${API_URL}/api/admin-chat/message/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, message: editText.trim() }),
      });
      setEditingId(null);
      if (selectedOther) fetchThread(selectedOther.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Удаляет всю переписку — только у себя, собеседник продолжит видеть
  // историю как обычно (симметрия с per-message hide выше).
  const handleDeleteThread = async () => {
    if (!user || !selectedOther) return;
    if (!confirm(`Удалить переписку с ${selectedOther.username}? Она пропадёт только у вас.`)) return;
    try {
      await fetch(`${API_URL}/api/admin-chat/thread/${user.id}/${selectedOther.id}`, { method: 'DELETE' });
      closeThread();
      fetchInbox();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteThreadFromList = async (otherId: string, username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (!confirm(`Удалить переписку с ${username}? Она пропадёт только у вас.`)) return;
    try {
      await fetch(`${API_URL}/api/admin-chat/thread/${user.id}/${otherId}`, { method: 'DELETE' });
      fetchInbox();
    } catch (err) {
      console.error(err);
    }
  };

  // ---------- Массовый выбор диалогов ----------

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleThreadPointerDown = (otherId: string) => {
    if (listSelectionMode) return;
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setListSelectionMode(true);
      setSelectedThreadIds(new Set([otherId]));
    }, LONG_PRESS_MS);
  };

  const handleThreadClick = (item: InboxItem) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (listSelectionMode) {
      setSelectedThreadIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.otherId)) next.delete(item.otherId);
        else next.add(item.otherId);
        return next;
      });
      return;
    }
    openThread(item.otherId, item.username, item.adminPermissions, item.isMainAdmin);
  };

  const exitListSelectionMode = () => {
    setListSelectionMode(false);
    setSelectedThreadIds(new Set());
  };

  const handleToggleSelectAllThreads = () => {
    const allSelected = inbox.length > 0 && inbox.every((i) => selectedThreadIds.has(i.otherId));
    if (allSelected) {
      setSelectedThreadIds(new Set());
    } else {
      setSelectedThreadIds(new Set(inbox.map((i) => i.otherId)));
    }
  };

  const handleBulkDeleteThreads = async () => {
    if (!user || selectedThreadIds.size === 0) return;
    if (!confirm(`Удалить выбранные переписки (${selectedThreadIds.size})? Они пропадут только у вас.`)) return;

    for (const otherId of selectedThreadIds) {
      try {
        await fetch(`${API_URL}/api/admin-chat/thread/${user.id}/${otherId}`, { method: 'DELETE' });
      } catch (err) {
        console.error(err);
      }
    }
    exitListSelectionMode();
    fetchInbox();
  };

  // ---------- Массовый выбор сообщений внутри треда ----------

  const handleMsgPointerDown = (id: number) => {
    if (msgSelectionMode) return;
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setMsgSelectionMode(true);
      setSelectedMsgIds(new Set([id]));
      setRevealedId(null);
    }, LONG_PRESS_MS);
  };

  const handleMsgClick = (m: AdminMessage) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (msgSelectionMode) {
      setSelectedMsgIds((prev) => {
        const next = new Set(prev);
        if (next.has(m.id)) next.delete(m.id);
        else next.add(m.id);
        return next;
      });
      return;
    }
    setRevealedId(revealedId === m.id ? null : m.id);
  };

  const exitMsgSelectionMode = () => {
    setMsgSelectionMode(false);
    setSelectedMsgIds(new Set());
  };

  const handleToggleSelectAllMsgs = () => {
    const allSelected = messages.length > 0 && messages.every((m) => selectedMsgIds.has(m.id));
    if (allSelected) {
      setSelectedMsgIds(new Set());
    } else {
      setSelectedMsgIds(new Set(messages.map((m) => m.id)));
    }
  };

  // Своё сообщение — удаляется у всех; чужое — только скрывается у себя.
  // Логика идентична одиночному handleDeleteOrHide, применяется массово
  // с одним общим подтверждением вместо запроса на каждое сообщение.
  const handleBulkDeleteMessages = async () => {
    if (!user || !selectedOther || selectedMsgIds.size === 0) return;
    if (!confirm(`Удалить/скрыть выбранные сообщения (${selectedMsgIds.size})?`)) return;

    const toProcess = messages.filter((m) => selectedMsgIds.has(m.id));

    for (const m of toProcess) {
      const isMine = m.sender_id === user.id;
      try {
        if (isMine) {
          await fetch(`${API_URL}/api/admin-chat/message/${m.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          });
        } else {
          await fetch(`${API_URL}/api/admin-chat/hide/${m.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ viewerId: user.id }),
          });
        }
      } catch (err) {
        console.error(err);
      }
    }

    exitMsgSelectionMode();
    fetchThread(selectedOther.id);
  };

  const filteredAdmins = allAdmins.filter((admin) => {
  const q = adminSearchQuery.trim().toLowerCase();
  if (!q) return true;
  return admin.id.toLowerCase().includes(q) || admin.username.toLowerCase().includes(q);
});

  // ---- Экран списка диалогов ----
  if (view === 'list') {
    return (
      <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-indigo-400">
            {listSelectionMode ? `Выбрано: ${selectedThreadIds.size}` : 'Переписка с админами'}
          </span>
          <div className="flex items-center gap-3">
            {listSelectionMode ? (
              <button onClick={exitListSelectionMode} className="text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors">
                ✕ Отмена
              </button>
            ) : (
              <button
                onClick={openNewChat}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
              >
                + Написать
              </button>
            )}
            {inbox.length > 0 && (
              <button onClick={handleToggleSelectAllThreads} className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                {inbox.every((i) => selectedThreadIds.has(i.otherId)) ? 'Снять выбор' : 'Выбрать все'}
              </button>
            )}
          </div>
        </div>

        {inbox.length === 0 && (
          <p className="text-slate-600 text-xs text-center py-6">
            Пока нет переписок — нажмите «Написать», чтобы начать
          </p>
        )}

        {!listSelectionMode && inbox.length > 0 && (
          <p className="text-slate-600 text-[10px] mb-2">Долгое нажатие на чат — режим выбора</p>
        )}

        <div className="flex flex-col gap-2 mb-3">
          {inbox.map((item) => {
            const isSelected = selectedThreadIds.has(item.otherId);
            return (
              <div
                key={item.otherId}
                onPointerDown={() => handleThreadPointerDown(item.otherId)}
                onPointerUp={clearLongPressTimer}
                onPointerLeave={clearLongPressTimer}
                onPointerCancel={clearLongPressTimer}
                onClick={() => handleThreadClick(item)}
                className={`w-full text-left rounded-xl p-3 flex items-center justify-between transition-colors cursor-pointer select-none ${
                  isSelected ? 'bg-indigo-950/40 ring-2 ring-indigo-500' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {listSelectionMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="accent-indigo-500 w-4 h-4 shrink-0 pointer-events-none"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-slate-100 text-sm font-medium truncate">{item.username}</p>
                      <AccessBadge permissions={item.adminPermissions} isMainAdmin={item.isMainAdmin} />
                    </div>
                    <p className="text-slate-500 text-xs truncate">{item.lastMessage}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {item.unreadCount > 0 && (
                    <span className="bg-indigo-600 text-white text-xs font-medium rounded-full px-2 py-0.5">
                      {item.unreadCount}
                    </span>
                  )}
                  {!listSelectionMode && (
                    <button
                      onClick={(e) => handleDeleteThreadFromList(item.otherId, item.username, e)}
                      className="text-red-400 hover:text-red-300 text-sm px-1"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {listSelectionMode && selectedThreadIds.size > 0 && (
          <button
            onClick={handleBulkDeleteThreads}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            Удалить выбранные ({selectedThreadIds.size})
          </button>
        )}
      </div>
    );
  }

  // ---- Экран выбора нового собеседника ----
  if (view === 'newChat') {
    return (
      <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-indigo-400">Выберите администратора</span>
          <button onClick={() => setView('list')} className="text-slate-500 hover:text-slate-300 text-xs">
            ← Назад
          </button>
        </div>

        {allAdmins.length > 0 && (
          <input
            type="text"
            value={adminSearchQuery}
            onChange={(e) => setAdminSearchQuery(e.target.value)}
            placeholder="Поиск по ID или имени..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500 mb-3"
          />
        )}

        {allAdmins.length === 0 && (
          <p className="text-slate-600 text-xs text-center py-6">Других администраторов пока нет</p>
        )}

        {allAdmins.length > 0 && filteredAdmins.length === 0 && (
          <p className="text-slate-600 text-xs text-center py-6">Никого не найдено</p>
        )}

        <div className="flex flex-col gap-2">
          {filteredAdmins.map((admin) => (
            <button
              key={admin.id}
              onClick={() => openThread(admin.id, admin.username, admin.admin_permissions, admin.is_main_admin)}
              className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded-xl p-3 flex items-center gap-2 transition-colors"
            >
              <span className="text-slate-100 text-sm font-medium">{admin.username}</span>
              <AccessBadge permissions={admin.admin_permissions} isMainAdmin={admin.is_main_admin} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- Экран переписки ----
  if (view === 'thread' && selectedOther && user) {
    const othersWithUnread = inbox.filter(
      (item) => item.otherId !== selectedOther.id && item.unreadCount > 0
    );
    const otherUnread = othersWithUnread.reduce((sum, item) => sum + item.unreadCount, 0);
    const latestOther = othersWithUnread.sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    )[0];

    return (
      <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5 h-[600px] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-indigo-400">{selectedOther.username}</span>
            <AccessBadge permissions={selectedOther.adminPermissions} isMainAdmin={selectedOther.isMainAdmin} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleDeleteThread} className="text-red-400 text-xs hover:text-red-300">
              Удалить чат
            </button>
            <button onClick={closeThread} className="text-slate-500 text-xs hover:text-slate-300">
              ← Назад
            </button>
          </div>
        </div>

        {latestOther && (
          <button
            onClick={() => openThread(latestOther.otherId, latestOther.username, latestOther.adminPermissions, latestOther.isMainAdmin)}
            className="w-full mb-3 bg-amber-600/20 border border-amber-600/50 rounded-lg py-2.5 px-3 text-left hover:bg-amber-600/30 transition-colors shrink-0"
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

        {messages.length > 0 && (
          <div className="flex items-center justify-between mb-2 shrink-0">
            <p className="text-slate-500 text-[10px]">
              {msgSelectionMode ? `Выбрано: ${selectedMsgIds.size}` : 'Долгое нажатие на сообщение — выбор'}
            </p>
            <div className="flex items-center gap-3">
              {msgSelectionMode && (
                <button onClick={exitMsgSelectionMode} className="text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors">
                  ✕ Отмена
                </button>
              )}
              <button onClick={handleToggleSelectAllMsgs} className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                {messages.every((m) => selectedMsgIds.has(m.id)) ? 'Снять выбор' : 'Выбрать все'}
              </button>
            </div>
          </div>
        )}

        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="flex flex-col gap-2 flex-1 overflow-y-auto mb-3"
        >
          {messages.length === 0 && (
            <p className="text-slate-600 text-xs text-center py-6">Пока сообщений нет</p>
          )}
          {messages.map((m) => {
            const isMine = m.sender_id === user.id;
            const isSelected = selectedMsgIds.has(m.id);
            return (
              <div
                key={m.id}
                onPointerDown={() => handleMsgPointerDown(m.id)}
                onPointerUp={clearLongPressTimer}
                onPointerLeave={clearLongPressTimer}
                onPointerCancel={clearLongPressTimer}
                onClick={() => handleMsgClick(m)}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm relative cursor-pointer select-none flex items-start gap-2 ${
                  isMine ? 'bg-indigo-600 text-white self-end' : 'bg-slate-800 text-slate-200 self-start'
                } ${isSelected ? 'ring-2 ring-amber-400' : ''}`}
              >
                {msgSelectionMode && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="accent-amber-400 w-3.5 h-3.5 shrink-0 mt-0.5 pointer-events-none"
                  />
                )}
                <div className="min-w-0 flex-1">
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
                        className="flex-1 bg-slate-900 text-slate-100 text-xs rounded px-2 py-1 outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(m.id)} className="text-emerald-400 text-xs">✓</button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 text-xs">✕</button>
                    </div>
                  ) : (
                    m.message && <span>{renderMessageText(m.message)}</span>
                  )}

                  {revealedId === m.id && editingId !== m.id && !msgSelectionMode && (
                    <div
                      className="flex gap-2 absolute -top-2 right-1 bg-slate-950 rounded px-1.5 py-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isMine && m.message && !m.attachment_type && (
                        <button onClick={() => handleStartEdit(m)} className="text-slate-400 hover:text-slate-200 text-xs">
                          ✎
                        </button>
                      )}
                      <button onClick={() => handleDeleteOrHide(m)} className="text-red-400 hover:text-red-300 text-xs">
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {msgSelectionMode && selectedMsgIds.size > 0 && (
          <div className="shrink-0 bg-slate-950 border-t border-slate-800 pt-3 mb-3 -mx-5 px-5">
            <button
              onClick={handleBulkDeleteMessages}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Удалить/скрыть выбранные ({selectedMsgIds.size})
            </button>
          </div>
        )}

        {showEmoji && !recordLocked && (
          <div className="flex flex-wrap gap-1.5 mb-2 bg-slate-800 rounded-lg p-2 shrink-0">
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
              className="bg-slate-800 hover:bg-red-600 text-red-400 hover:text-white rounded-lg px-3 py-2.5 transition-colors shrink-0"
              title="Удалить запись"
            >
              🗑
            </button>
            <button
              onClick={handlePauseResume}
              className="flex-1 bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 flex items-center justify-center gap-2 transition-colors"
            >
              {isPaused ? '▶️ Возобновить' : '⏸️ Пауза'} · {formatDuration(recordingSeconds)}
            </button>
            <button
              onClick={stopRecording}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors shrink-0"
              title="Отправить"
            >
              ➤
            </button>
          </div>
        ) : (
          <div className="shrink-0">
            {isRecording && (
              <p className="text-slate-500 text-[11px] text-center pb-1.5">
                ↑ Вверх — блокировка · ← Влево — отмена · отпустите — отправить
              </p>
            )}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full pl-3 pr-1.5 py-1 focus-within:border-indigo-500 min-w-0">
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
                    if (selectedOther) saveDraft(selectedOther.id, e.target.value);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  onFocus={() => setShowEmoji(false)}
                  placeholder="Сообщение..."
                  disabled={isRecording}
                  className="flex-1 bg-transparent text-slate-100 text-sm outline-none min-w-0 py-2 disabled:opacity-50"
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
                  className="shrink-0 text-base leading-none disabled:opacity-50"
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
                  disabled={uploading || isRecording}
                  className="shrink-0 text-base leading-none disabled:opacity-50 pr-1"
                >
                  📸
                </button>
              </div>

              {input.trim() && !isRecording ? (
                <button
                  onClick={handleSend}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full w-11 h-11 flex items-center justify-center shrink-0 transition-colors text-lg"
                >
                  ➤
                </button>
              ) : (
                <button
                  onPointerDown={handleMicPointerDown}
                  onPointerUp={handleMicPointerUp}
                  onPointerCancel={handleMicPointerCancel}
                  onPointerMove={handleMicPointerMove}
                  onTouchStart={(e) => e.preventDefault()}
                  className={`rounded-full w-11 h-11 flex items-center justify-center shrink-0 select-none transition-colors ${
                    isRecording
                      ? 'bg-red-600 text-white text-xs font-mono'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 text-lg'
                  }`}
                >
                  {isRecording ? formatDuration(recordingSeconds) : '🎤'}
                </button>
              )}
            </div>
          </div>
        )}
        {recordError && <p className="text-red-400 text-xs mt-1 shrink-0">{recordError}</p>}

        {uploadPreview && (
          <div className="relative mt-2 shrink-0 inline-block">
            {uploadPreview.type === 'image' ? (
              <img
                src={uploadPreview.url}
                alt="превью"
                className="rounded-lg max-h-40 opacity-20"
              />
            ) : (
              <video
                src={uploadPreview.url}
                className="rounded-lg max-h-40 opacity-20"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default AdminChatView;


import React, { useEffect, useRef, useState } from "react";
import { useUser } from "../authorization/UserContext";
import { API_URL } from "../config";
import { uploadToCloudinary, getOptimizedUrl } from "../utils/cloudinaryUpload";

const TAP_THRESHOLD_MS = 300;
const SWIPE_CANCEL_PX = 80;
const LONG_PRESS_MS = 550;

const EMOJI_LIST = [
  "😀",
  "😂",
  "😍",
  "👍",
  "🙏",
  "🎉",
  "❤️",
  "😢",
  "😮",
  "🤔",
  "👋",
  "🔥",
];
const MAX_VIDEO_SIZE_MB = 15;

function renderMessageText(text: string): React.ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map(
    (part, i): React.ReactNode =>
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
      ),
  );
}

// Небольшие инлайн-SVG иконки для верхней плашки выбора — без внешних
// зависимостей, в духе WhatsApp (тонкая обводка, 20x20).
const BackArrowIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const CopyIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const PencilIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const TrashIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
  </svg>
);
const MessageIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
  </svg>
);

const SmileIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);
const PaperclipIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L9.41 17.41a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" />
  </svg>
);
const CameraIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const MicIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
    <line x1="12" y1="18" x2="12" y2="22" />
  </svg>
);

const ChevronsDownIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m7 6 5 5 5-5" />
    <path d="m7 13 5 5 5-5" />
  </svg>
);

const PauseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);
const PlayIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);
const SendIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);
const LockIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const CheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ: FaqItem[] = [
  {
    question: "Как начисляются баллы?",
    answer:
      "За прохождение каждой станции квеста — подробности смотри в разделе «Станции квеста» ниже на этой странице.",
  },
  {
    question: "Как получить приз?",
    answer:
      "Набери баллы, зайди в «Магазин призов» и выбери подарок — администратор выдаст его на стойке.",
  },
  {
    question: "Я забыл, на каких станциях уже был",
    answer:
      "Смотри блок «Прогресс по станциям» на этой странице — там отмечено, что уже пройдено.",
  },
  {
    question: "Что-то не работает в приложении",
    answer:
      "Попробуй обновить страницу. Если не помогло — напиши администратору ниже.",
  },
];

interface ChatMessage {
  id: number;
  sender: "participant" | "admin";
  message: string | null;
  attachment_type: string | null;
  attachment_data: string | null;
  created_at: string;
  is_deleted?: boolean;
}

// Черновик недописанного сообщения — переживает F5 и переключение вкладок,
// как в ChatInbox (там на каждого собеседника отдельно, здесь собеседник
// всегда один — администратор — поэтому ключ по своему userId).
const DRAFT_KEY_PREFIX = "helpbot_draft_";

function loadDraft(userId: string): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY_PREFIX + userId) ?? "";
  } catch {
    return "";
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
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordLocked, setRecordLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordError, setRecordError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [msgSelectionMode, setMsgSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const handlePressStart = (id: number) => {
    if (msgSelectionMode) return;
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setMsgSelectionMode(true);
      setSelectedMsgIds(new Set([id]));
    }, LONG_PRESS_MS);
  };

  const handlePressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const exitMsgSelectionMode = () => {
    setMsgSelectionMode(false);
    setSelectedMsgIds(new Set());
  };

  const toggleMsgSelected = (id: number) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) {
        // Сняли последнюю отметку — выходим из режима выбора.
        setMsgSelectionMode(false);
      }
      return next;
    });
  };

  const handleCopySelected = async () => {
    const texts = messages
      .filter((m) => selectedMsgIds.has(m.id) && m.message)
      .map((m) => m.message as string);
    if (texts.length > 0) {
      try {
        await navigator.clipboard.writeText(texts.join("\n"));
      } catch (err) {
        console.error(err);
      }
    }
    exitMsgSelectionMode();
  };

  const canEditSelection =
    selectedMsgIds.size === 1 &&
    (() => {
      const id = Array.from(selectedMsgIds)[0];
      const m = messages.find((msg) => msg.id === id);
      return (
        !!m && m.sender === "participant" && !!m.message && !m.attachment_type
      );
    })();

  const handleEditSelected = () => {
    if (!canEditSelection) return;
    const id = Array.from(selectedMsgIds)[0];
    const m = messages.find((msg) => msg.id === id);
    if (!m) return;
    setEditingId(m.id);
    setEditText(m.message || "");
    exitMsgSelectionMode();
  };

  // «Удалить у всех» — своё сообщение удаляется из базы для обеих сторон;
  // сообщение админа участник физически не может удалить у самого админа,
  // поэтому для него это тоже сводится к скрытию только у себя.
  const handleConfirmDeleteAll = async () => {
    const toProcess = messages.filter((m) => selectedMsgIds.has(m.id));
    for (const m of toProcess) {
      try {
        if (m.sender === "admin") {
          locallyHiddenRef.current.add(m.id);
          await fetch(`${API_URL}/api/chat/hide/${m.id}`, { method: "POST" });
        } else {
          await fetch(`${API_URL}/api/chat/message/${m.id}`, {
            method: "DELETE",
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
    setShowDeleteModal(false);
    exitMsgSelectionMode();
    fetchMessages();
  };

  // «Удалить у меня» — для сообщений админа это стойкое скрытие
  // (сохраняется на сервере). Для своих сообщений — только локальное
  // скрытие на время сессии: после перезагрузки они снова появятся,
  // поскольку «скрыть только у себя» для собственного сообщения на
  // бэкенде сейчас не хранится.
  const handleConfirmDeleteForMe = async () => {
    const toProcess = messages.filter((m) => selectedMsgIds.has(m.id));
    for (const m of toProcess) {
      locallyHiddenRef.current.add(m.id);
      if (m.sender === "admin") {
        try {
          await fetch(`${API_URL}/api/chat/hide/${m.id}`, { method: "POST" });
        } catch (err) {
          console.error(err);
        }
      }
    }
    setMessages((prev) => prev.filter((msg) => !selectedMsgIds.has(msg.id)));
    setShowDeleteModal(false);
    exitMsgSelectionMode();
  };

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unreadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const mobileMessagesContainerRef = useRef<HTMLDivElement>(null);
  const desktopMessagesContainerRef = useRef<HTMLDivElement>(null);
  const desktopChatBlockRef = useRef<HTMLDivElement>(null);

  const shouldAutoScrollRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
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
        const filtered = (data as ChatMessage[]).filter(
          (m) => !locallyHiddenRef.current.has(m.id),
        );
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        recordCancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
    };
  }, []);

  // Десктоп: при открытии чата плавно прокручиваем страницу так, чтобы
  // весь блок чата (700px) оказался в поле зрения, а не открывался ниже
  // текущей позиции скролла, требуя ручной прокрутки. Только на десктопе —
  // мобильная версия открывается как полноэкранный оверлей и не нуждается
  // в прокрутке фоновой страницы.
  useEffect(() => {
    if (!showChat) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) return;

    // Небольшая задержка — блок должен успеть отрендериться и получить
    // реальную высоту (700px) до того, как scrollIntoView посчитает позицию.
    const timer = setTimeout(() => {
      desktopChatBlockRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [showChat]);

  // Автопрокрутка к последнему сообщению — только если пользователь и так
  // был внизу (или это первое открытие чата). Прокручиваем scrollTop у
  // ОБОИХ контейнеров (мобильный/десктопный) — реально смонтирован в DOM
  // только один из них в зависимости от ширины экрана, второй просто не
  // найдётся (ref.current === null) и молча пропускается.
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    if (mobileMessagesContainerRef.current) {
      mobileMessagesContainerRef.current.scrollTop =
        mobileMessagesContainerRef.current.scrollHeight;
    }
    if (desktopMessagesContainerRef.current) {
      desktopMessagesContainerRef.current.scrollTop =
        desktopMessagesContainerRef.current.scrollHeight;
    }
    setShowScrollDown(false);
  }, [messages]);

  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 80;
    shouldAutoScrollRef.current = atBottom;
    setShowScrollDown(!atBottom);
  };

  const scrollToBottom = () => {
    if (mobileMessagesContainerRef.current) {
      mobileMessagesContainerRef.current.scrollTo({
        top: mobileMessagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    if (desktopMessagesContainerRef.current) {
      desktopMessagesContainerRef.current.scrollTo({
        top: desktopMessagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    shouldAutoScrollRef.current = true;
    setShowScrollDown(false);
  };

  // Полноэкранный мобильный оверлей — блокируем прокрутку фонового
  // контента страницы, пока он открыт, чтобы свайп по чату не листал
  // дашборд позади него. ВАЖНО: применяется только на мобильной ширине
  // (совпадает с md:hidden брейкпоинтом оверлея, 768px) — на десктопе
  // блок чата встроен в обычный поток страницы (не оверлей), и блокировка
  // скролла там ошибочно не давала прокрутить страницу вниз, чтобы
  // увидеть нижнюю часть блока высотой 650px.
  useEffect(() => {
    if (!showChat) return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [showChat]);

  const sendMessage = async (
    text: string | null,
    attachmentType?: string,
    attachmentData?: string,
  ) => {
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          sender: "participant",
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
    setInput("");
    saveDraft(user.id, "");
    await sendMessage(text);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith("video") ? "video" : "image";

    if (type === "video" && file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      alert(
        `Видео слишком большое (макс. ${MAX_VIDEO_SIZE_MB} МБ) — попробуйте снять покороче`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setUploadPreview({ url: previewUrl, type });
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, type, file.name);
      await sendMessage(null, type, url);
    } catch (err) {
      console.error(err);
      alert(
        "Не удалось загрузить файл — проверьте интернет и попробуйте снова",
      );
    } finally {
      setUploading(false);
      setUploadPreview(null);
      URL.revokeObjectURL(previewUrl);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const getSupportedMimeType = (): string => {
    const candidates = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
  };

  // Запись голосового — WhatsApp/Telegram-стиль: долгое нажатие на 🎤
  // записывает, пока держите палец, отпустили — автоотправка; короткий
  // тап "фиксирует" запись в отдельном режиме с Пауза/Возобновить,
  // 🗑 Отмена и ➤ Отправить (см. handleMicPointerUp).
  const startRecording = async () => {
    setRecordError("");
    recordCancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (recordingIntervalRef.current)
          clearInterval(recordingIntervalRef.current);
        stream.getTracks().forEach((t) => t.stop());

        if (recordCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        if (audioChunksRef.current.length === 0) {
          setRecordError("Запись не удалась, попробуйте ещё раз");
          return;
        }

        const blob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        uploadToCloudinary(blob, "audio", "voice-message.webm")
          .then((url) => sendMessage(null, "audio", url))
          .catch((err) => {
            console.error(err);
            setRecordError("Не удалось загрузить запись — проверьте интернет");
          });
      };
      recorder.onerror = () => {
        setRecordError("Ошибка записи");
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
      setRecordError("Нет доступа к микрофону");
    }
  };

  // Отпустили кнопку 🎤 — либо отправляем (долгое удержание), либо
  // переходим в зафиксированный режим (короткий тап).
  const handleMicPointerUp = () => {
    if (!isRecording || recordLocked) return;
    const held =
      micPressStartRef.current === 0
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
      recordingIntervalRef.current = setInterval(
        () => setRecordingSeconds((s) => s + 1),
        1000,
      );
    } else {
      recorder.pause();
      setIsPaused(true);
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
    }
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // const handleDeleteMessage = async (m: ChatMessage) => {
  //   if (m.sender === 'admin') {
  //     if (!confirm('Скрыть это сообщение у себя? Администратор продолжит видеть его как обычно.')) return;

  //     locallyHiddenRef.current.add(m.id);
  //     setMessages((prev) => prev.filter((msg) => msg.id !== m.id));

  //     try {
  //       await fetch(`${API_URL}/api/chat/hide/${m.id}`, { method: 'POST' });
  //       fetchMessages();
  //     } catch (err) {
  //       console.error(err);
  //     }
  //   } else {
  //     if (!confirm('Удалить это сообщение?')) return;
  //     try {
  //       await fetch(`${API_URL}/api/chat/message/${m.id}`, { method: 'DELETE' });
  //       fetchMessages();
  //     } catch (err) {
  //       console.error(err);
  //     }
  //   }
  // };

  // const handleStartEdit = (m: ChatMessage) => {
  //   setEditingId(m.id);
  //   setEditText(m.message || '');
  //   setRevealedId(null);
  // };

  const handleSaveEdit = async (id: number) => {
    if (!editText.trim()) return;
    try {
      await fetch(`${API_URL}/api/chat/message/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: editText.trim() }),
      });
      setEditingId(null);
      fetchMessages();
    } catch (err) {
      console.error(err);
    }
  };

  // Полноэкранный оверлей редактирования — переписка за ним видна
  // затемнённой, снизу поле ввода с текущим текстом и кнопкой
  // подтверждения. Родительский контейнер должен быть relative, чтобы
  // этот inset-0 позиционировался внутри него.
  const renderEditOverlay = () => {
    if (editingId === null) return null;
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-slate-900">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setEditingId(null)}
            className="text-slate-200 hover:text-white"
            aria-label="Отмена"
          >
            <BackArrowIcon />
          </button>
          <span className="text-slate-100 text-sm font-medium">
            Редактирование сообщения
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 opacity-40 pointer-events-none">
          {renderMessages()}
        </div>

        <div className="px-4 pb-4 pt-2 shrink-0 border-t border-slate-800">
          {showEmoji && (
            <div className="flex flex-wrap gap-1.5 mb-2 bg-slate-800 rounded-lg p-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setEditText((prev) => prev + emoji)}
                  className="text-lg hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <div className="flex-1 flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full pl-3 pr-1.5 py-1 focus-within:border-indigo-500">
              <button
                onClick={() => setShowEmoji((v) => !v)}
                className="shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-200"
              >
                <SmileIcon />
              </button>
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSaveEdit(editingId)
                }
                onFocus={() => setShowEmoji(false)}
                autoFocus
                className="flex-1 bg-transparent text-slate-100 text-sm outline-none min-w-0 py-2"
              />
            </div>
            <button
              onClick={() => handleSaveEdit(editingId)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full w-10 h-10 flex items-center justify-center shrink-0 transition-colors"
              aria-label="Сохранить"
            >
              <CheckIcon />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Список сообщений — общий рендер, используется и в мобильном оверлее,
  // и в десктопном встроенном блоке (только один из двух реально
  // смонтирован в DOM одновременно благодаря md:hidden / hidden md:flex).
  const renderSelectionTopBar = () => (
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0 bg-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={exitMsgSelectionMode}
            className="text-slate-200 hover:text-white"
            aria-label="Назад"
          >
            <BackArrowIcon />
          </button>
          <span className="text-slate-100 text-sm font-medium">
            {selectedMsgIds.size}
          </span>
          <button
            onClick={() => {
              const allSelected =
                messages.length > 0 &&
                messages.every((m) => selectedMsgIds.has(m.id));
              setSelectedMsgIds(
                allSelected ? new Set() : new Set(messages.map((m) => m.id)),
              );
            }}
            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {messages.length > 0 &&
            messages.every((m) => selectedMsgIds.has(m.id))
              ? "Снять выбор"
              : "Выбрать все"}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleCopySelected}
            className="text-slate-300 hover:text-white"
            aria-label="Копировать"
          >
            <CopyIcon />
          </button>
          <button
            onClick={handleEditSelected}
            disabled={!canEditSelection}
            className="text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
            aria-label="Редактировать"
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="text-red-400 hover:text-red-300"
            aria-label="Удалить"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    );

  // Модалка удаления выбранных сообщений. «Отмена» полностью выходит из
  // режима выбора, а не просто закрывает модалку.
  const renderDeleteModal = () => {
    if (!showDeleteModal) return null;
    const selectedMessages = messages.filter((m) => selectedMsgIds.has(m.id));
    const allOwn =
      selectedMessages.length > 0 &&
      selectedMessages.every((m) => m.sender === "participant");

    const handleCancel = () => {
      setShowDeleteModal(false);
      exitMsgSelectionMode();
    };

    return (
      <div
        className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-6"
        onClick={handleCancel}
      >
        <div
          className="bg-slate-900 rounded-2xl w-full max-w-xs px-5 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-slate-100 text-base mb-4">
            {selectedMsgIds.size > 1
              ? `Удалить сообщения (${selectedMsgIds.size})?`
              : "Удалить сообщение?"}
          </p>
          <div className="flex flex-col items-end gap-1">
            {allOwn && (
              <button
                onClick={handleConfirmDeleteAll}
                className="px-2 py-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
              >
                Удалить у всех
              </button>
            )}
            <button
              onClick={handleConfirmDeleteForMe}
              className="px-2 py-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
            >
              Удалить у меня
            </button>
            <button
              onClick={handleCancel}
              className="px-2 py-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMessages = () => (
    <>
      {messages.length === 0 && (
        <p className="text-slate-600 text-xs text-center py-2">
          Напишите свой вопрос ниже
        </p>
      )}
      {messages.map((m) => {
        const isMediaOnly = !!m.attachment_type && !m.message;
        const isSelected = selectedMsgIds.has(m.id);
        return (
          <div
            key={m.id}
            onPointerDown={() => handlePressStart(m.id)}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onPointerCancel={handlePressEnd}
            onClick={() => {
              if (longPressFiredRef.current) {
                longPressFiredRef.current = false;
                return;
              }
              if (msgSelectionMode) {
                toggleMsgSelected(m.id);
              }
            }}
            className={`w-full flex select-none cursor-pointer rounded-md px-1.5 py-1 transition-colors ${
              m.sender === "participant" ? "justify-end" : "justify-start"
            } ${isSelected ? "bg-indigo-500/15" : ""}`}
          >
            <div
              className={`max-w-[80%] w-fit rounded-lg text-sm relative transition-all ${
                isMediaOnly ? "" : "px-3 py-2"
              } ${
                isMediaOnly
                  ? "bg-transparent"
                  : m.sender === "participant"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-200"
              } ${isSelected ? "brightness-75" : ""}`}
            >
              {m.is_deleted ? (
                <span className="flex items-center gap-1.5 italic text-slate-400">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m4.9 4.9 14.2 14.2" />
                  </svg>
                  Сообщение удалено
                </span>
              ) : (
                <>
                  {m.attachment_type === "image" && (
                    <img
                      src={getOptimizedUrl(
                        m.attachment_data!,
                        "w_480,q_auto,f_auto",
                      )}
                      alt="вложение"
                      onClick={() => {
                        if (longPressFiredRef.current) return;
                        if (msgSelectionMode) return;
                        window.open(
                          getOptimizedUrl(
                            m.attachment_data!,
                            "w_1600,q_auto,f_auto",
                          ),
                          "_blank",
                        );
                      }}
                      className="rounded-lg mb-1 cursor-pointer"
                      style={{
                        maxWidth: "240px",
                        maxHeight: "320px",
                        minWidth: "240px",
                        width: "auto",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  )}
                  {m.attachment_type === "video" && (
                    <video
                      src={m.attachment_data!}
                      controls
                      className={`rounded-lg mb-1 ${msgSelectionMode ? "pointer-events-none" : ""}`}
                      style={{
                        width: "240px",
                        height: "320px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}
                  {m.attachment_type === "audio" && (
                    <div className="relative">
                      <audio
                        src={m.attachment_data!}
                        controls
                        className={`max-w-full mb-1 ${msgSelectionMode ? "pointer-events-none" : ""}`}
                      />
                      {/* Прозрачный слой поверх плеера: ловит долгое нажатие
                          (аудио-контролы иначе съедают pointerdown), а короткий
                          тап пропускает вниз к самим контролам. */}
                      <div
                        className="absolute inset-0"
                        id={`audio-overlay-${m.id}`}
                        onPointerDown={(e) => {
                          handlePressStart(m.id);
                          (e.currentTarget as HTMLElement).style.pointerEvents = "none";
                          setTimeout(() => {
                            const el = document.getElementById(`audio-overlay-${m.id}`);
                            if (el) el.style.pointerEvents = "auto";
                          }, 0);
                        }}
                        onPointerUp={handlePressEnd}
                        onPointerCancel={handlePressEnd}
                      />
                    </div>
                  )}

                  {m.message && <span>{renderMessageText(m.message)}</span>}
                </>
              )}
            </div>
          </div>
        );
      })}
      {uploadPreview && (
        <div className="w-fit self-end rounded-lg relative overflow-hidden">
          {uploadPreview.type === "image" ? (
            <img
              src={uploadPreview.url}
              alt="превью"
              className="rounded-lg block"
              style={{
                maxWidth: "240px",
                maxHeight: "320px",
                width: "auto",
                height: "auto",
                filter: "brightness(0.3)",
              }}
            />
          ) : (
            <video
              src={uploadPreview.url}
              className="rounded-lg block"
              style={{
                width: "240px",
                height: "320px",
                objectFit: "cover",
                filter: "brightness(0.3)",
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}
    </>
  );

  // Поле ввода + панель эмодзи + запись голоса — общий рендер, тоже
  // используется и мобильной, и десктопной версией.
  const renderComposer = () => (
    <>
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
            className="bg-slate-800 hover:bg-red-600 text-red-400 hover:text-white rounded-lg px-3 py-2.5 transition-colors shrink-0 flex items-center justify-center"
            title="Удалить запись"
          >
            <TrashIcon />
          </button>
          <button
            onClick={handlePauseResume}
            className="flex-1 bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 flex items-center justify-center gap-2 transition-colors"
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
            {isPaused ? "Возобновить" : "Пауза"} ·{" "}
            {formatDuration(recordingSeconds)}
          </button>
          <button
            onClick={stopRecording}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors shrink-0"
            title="Отправить"
          >
            <SendIcon />
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
                className="shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-200 disabled:opacity-50"
              >
                <SmileIcon />
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (user) saveDraft(user.id, e.target.value);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                onFocus={() => setShowEmoji(false)}
                placeholder="Ваш вопрос..."
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
                className="shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-200 disabled:opacity-50"
              >
                <PaperclipIcon />
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
                className="shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-200 disabled:opacity-50 pr-1"
              >
                <CameraIcon />
              </button>
            </div>

            {input.trim() && !isRecording ? (
              <button
                onClick={handleSend}
                 className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full w-11 h-11 flex items-center justify-center shrink-0 transition-colors"
              >
                <SendIcon />
              </button>
            ) : (
              <div className="relative shrink-0">
                {isRecording && !recordLocked && (
                  <>
                    {/* Дорожка вверх до замка блокировки — градиентная линия,
                        затухающая от кнопки к иконке, с мягким свечением. */}
                    <div
                      className="absolute -top-16 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                      style={{ height: "64px" }}
                    >
                      <div className="relative bg-indigo-600 rounded-full w-9 h-9 flex items-center justify-center shadow-lg shadow-indigo-500/50 animate-bounce shrink-0 text-white">
                        <LockIcon />
                      </div>
                      <div
                        className="flex-1 w-[2px] mt-1 rounded-full"
                        style={{
                          background:
                            "linear-gradient(to bottom, rgba(99,102,241,0.7), rgba(99,102,241,0.05))",
                        }}
                      />
                    </div>
                    {/* Дорожка влево до отметки отмены — та же градиентная логика,
                        затухает от кнопки к значку ✕. */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 right-full flex items-center pointer-events-none"
                      style={{ width: "60px" }}
                    >
                      <span className="text-red-400 shrink-0 drop-shadow flex items-center">
                        <CloseIcon />
                      </span>
                      <div
                        className="flex-1 h-[2px] ml-1.5 rounded-full"
                        style={{
                          background:
                            "linear-gradient(to left, rgba(239,68,68,0.05), rgba(239,68,68,0.6))",
                        }}
                      />
                    </div>
                  </>
                )}
                <button
                  onPointerDown={handleMicPointerDown}
                  onPointerUp={handleMicPointerUp}
                  onPointerCancel={handleMicPointerUp}
                  onPointerMove={handleMicPointerMove}
                  onTouchStart={(e) => e.preventDefault()}
                  className={`rounded-full w-11 h-11 flex items-center justify-center select-none transition-colors relative z-10 ${
                    isRecording
                      ? "bg-red-600 text-white text-xs font-mono"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 text-lg"
                  }`}
                >
                  {isRecording ? formatDuration(recordingSeconds) : <MicIcon />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {recordError && (
        <p className="text-red-400 text-xs mt-1 shrink-0">{recordError}</p>
      )}
    </>
  );

  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
        Помощь
      </h2>

      <div className="flex flex-col gap-2">
        {FAQ.map((item, i) => (
          <div
            key={i}
            className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full text-left px-3 py-2.5 text-slate-100 text-sm font-medium flex items-center justify-between"
            >
              {item.question}
              <span className="text-slate-500 text-xs">
                {openFaq === i ? "−" : "+"}
              </span>
            </button>
            {openFaq === i && (
              <p className="px-3 pb-3 text-slate-400 text-xs leading-relaxed">
                {item.answer}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowChat(true)}
        className="relative w-full mt-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
      >
        <MessageIcon />
        Не нашли ответ? Написать администратору
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 shadow-md">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Мобильный: полноэкранный оверлей (fixed inset-0, весь экран
          устройства), закрывается кнопкой "← Назад". Скрыт на md и шире. */}
      {showChat && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900 flex flex-col">
          {renderEditOverlay()}
          {msgSelectionMode ? (
            renderSelectionTopBar()
          ) : (
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
              <button
                onClick={() => setShowChat(false)}
                className="text-slate-300 hover:text-white text-xl leading-none px-1 -ml-1"
                aria-label="Назад"
              >
                ←
              </button>
              <span className="text-slate-100 text-sm font-medium">Admin</span>
            </div>
          )}

          <div className="relative flex-1 min-h-0">
            <div
              ref={mobileMessagesContainerRef}
              onScroll={handleMessagesScroll}
              className="h-full overflow-y-auto px-4 py-3 flex flex-col gap-2"
            >
              {renderMessages()}
            </div>
            {showScrollDown && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-3 right-4 bg-white text-slate-700 rounded-full w-9 h-9 flex items-center justify-center shadow-lg hover:bg-slate-100 transition-colors"
                aria-label="Вниз"
              >
                <ChevronsDownIcon />
              </button>
            )}
          </div>

          <div className="px-4 pb-4 shrink-0">{renderComposer()}</div>
        </div>
      )}

      {/* Десктоп: встроенный блок фиксированной высоты, без оверлея.
          Видим только на md и шире. */}
      {showChat && (
        <div
          ref={desktopChatBlockRef}
          className="hidden md:flex mt-3 bg-slate-950 border border-slate-800 rounded-xl p-3 h-[700px] flex-col relative"
        >
          {renderEditOverlay()}
          {msgSelectionMode ? (
            <div className="-mx-3 -mt-3 mb-2">{renderSelectionTopBar()}</div>
          ) : (
            <div className="flex items-center justify-between mb-2 shrink-0">
              <button
                onClick={() => setShowChat(false)}
                className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1.5"
              >
                <BackArrowIcon />
                
              </button>
              <span className="text-slate-100 text-sm font-medium">Admin</span>
            </div>
          )}

          {/* {renderMsgSelectionBar()} */}

          <div className="relative flex-1 min-h-0 mb-2">
            <div
              ref={desktopMessagesContainerRef}
              onScroll={handleMessagesScroll}
              className="h-full flex flex-col gap-2 overflow-y-auto no-scrollbar"
            >
              {renderMessages()}
            </div>
            {showScrollDown && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-3 right-4 bg-white text-slate-700 rounded-full w-9 h-9 flex items-center justify-center shadow-lg hover:bg-slate-100 transition-colors"
                aria-label="Вниз"
              >
                <ChevronsDownIcon />
              </button>
            )}
          </div>

          {renderComposer()}
        </div>
      )}

      {renderDeleteModal()}
    </div>
  );
};

export default HelpBot;

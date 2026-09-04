import React, { useEffect, useRef, useState } from "react";
import { useSmartPolling } from "../../hooks/useSmartPolling";
import { useUser } from "../../authorization/UserContext";
import { API_URL } from "../../config";
import { type AdminTabId } from "../../adminTabs";
import {
  uploadToCloudinary,
  getOptimizedUrl,
} from "../../utils/cloudinaryUpload";

const LONG_PRESS_MS = 550;
const TAP_THRESHOLD_MS = 200;

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

// Небольшие инлайн-SVG иконки — без внешних зависимостей, в духе
// WhatsApp. Тот же набор, что в ChatInbox и HelpBot.
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
const BellIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const SearchIcon = () => (
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
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const DotsIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

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
          ? "bg-purple-950/60 text-purple-300 border border-purple-500/30"
          : isFull
            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
            : "bg-amber-950/60 text-amber-400 border border-amber-500/30"
      }`}
    >
      {isMainAdmin ? "👑 Главный" : isFull ? "Полный" : "Частичный"}
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

type View = "list" | "thread";

// Какой экран/собеседник был открыт — переживает F5.
const ADMINCHAT_STORAGE_KEY = "admin_adminchat_state";

interface PersistedAdminChatState {
  view: View;
  selectedOther: {
    id: string;
    username: string;
    adminPermissions: AdminTabId[] | null;
    isMainAdmin?: boolean;
  } | null;
}

function loadPersistedAdminChatState(): PersistedAdminChatState {
  try {
    const raw = sessionStorage.getItem(ADMINCHAT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedAdminChatState;
  } catch {
    // не критично
  }
  return { view: "list", selectedOther: null };
}

// Черновик недописанного сообщения — отдельно на каждого собеседника,
// переживает F5 и переключение между чатами.
const DRAFT_KEY_PREFIX = "admin_adminchat_draft_";

function loadDraft(otherId: string): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY_PREFIX + otherId) ?? "";
  } catch {
    return "";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOther, setSelectedOther] = useState<{
    id: string;
    username: string;
    adminPermissions: AdminTabId[] | null;
    isMainAdmin?: boolean;
  } | null>(persisted.selectedOther);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
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

  // Массовый выбор в списке диалогов
  const [listSelectionMode, setListSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(
    new Set(),
  );
  const [showThreadMenu, setShowThreadMenu] = useState(false);
  const [showThreadDeleteModal, setShowThreadDeleteModal] = useState(false);

  // Массовый выбор внутри открытой переписки
  const [msgSelectionMode, setMsgSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const mobileMessagesContainerRef = useRef<HTMLDivElement>(null);
  const desktopMessagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const micPressStartRef = useRef(0);
  const micPressXRef = useRef(0);
  const micPressYRef = useRef(0);
  const recordCancelledRef = useRef(false);
  const SWIPE_CANCEL_PX = 80;

  const EMOJI_LIST = [
    "😀",
    "😂",
    "👍",
    "🙏",
    "🎉",
    "❤️",
    "😢",
    "😮",
    "🤔",
    "👋",
    "🔥",
    "✅",
  ];

  useEffect(() => {
    try {
      sessionStorage.setItem(
        ADMINCHAT_STORAGE_KEY,
        JSON.stringify({ view, selectedOther }),
      );
    } catch {
      // не критично
    }
  }, [view, selectedOther]);

  // Останавливаем запись при размонтировании компонента (переключение чата,
  // смена вкладки) — иначе микрофон продолжает работать в фоне.
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
    if (view === "list" || view === "thread") fetchInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useSmartPolling(fetchInbox, 8000, view === "list" || view === "thread");

  // Полный список админов грузим один раз — их немного, поиск фильтрует
  // локально, отдельный экран выбора собеседника больше не нужен.
  useEffect(() => {
    fetchAllAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const fetchThread = async (otherId: string) => {
    if (!user) return;
    try {
      const res = await fetch(
        `${API_URL}/api/admin-chat/thread/${user.id}/${otherId}`,
      );
      const data = await res.json();
      if (res.ok) setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openThread = async (
    otherId: string,
    username: string,
    adminPermissions: AdminTabId[] | null,
    isMainAdmin?: boolean,
  ) => {
    setSearchQuery("");
    setSelectedOther({ id: otherId, username, adminPermissions, isMainAdmin });
    setInput(loadDraft(otherId));
    shouldAutoScrollRef.current = true;
    setView("thread");
    setMsgSelectionMode(false);
    setSelectedMsgIds(new Set());
    await fetchThread(otherId);

    if (!user) return;
    try {
      await fetch(`${API_URL}/api/admin-chat/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfId: user.id, otherId }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Если после F5 оказались на экране треда — подтягиваем сообщения и
  // черновик; сам поллинг ниже через useSmartPolling.
  useEffect(() => {
    if (view !== "thread" || !selectedOther) return;
    setInput(loadDraft(selectedOther.id));
    fetchThread(selectedOther.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSmartPolling(
    () => {
      if (selectedOther && user) {
        fetchThread(selectedOther.id);
        // Повторно отмечаем прочитанным при каждом тике, пока тред открыт —
        // иначе сообщения, пришедшие уже ПОСЛЕ открытия (первый mark-read
        // был только в openThread), остаются непрочитанными на сервере,
        // и счётчик на вкладке "Чат админов" растёт даже когда админ
        // прямо сейчас смотрит в этот чат.
        fetch(`${API_URL}/api/admin-chat/mark-read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selfId: user.id, otherId: selectedOther.id }),
        }).catch((err) => console.error(err));
      }
    },
    3000,
    view === "thread" && !!selectedOther,
  );

  // Автопрокрутка к последнему сообщению — только если пользователь и так
  // был внизу (или это первое открытие треда). Прокручиваем ОБА контейнера
  // (мобильный/десктопный) — реально смонтирован в DOM только один из них
  // в зависимости от ширины экрана, второй просто null и пропускается.
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

  // Мобильный полноэкранный оверлей — блокируем прокрутку страницы позади
  // него, только на мобильной ширине (совпадает с md:hidden брейкпоинтом,
  // 768px) — на десктопе блок встроен в обычный поток страницы.
  useEffect(() => {
    if (view !== "thread") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [view]);

  const closeThread = () => {
    // Останавливаем запись если она была активна
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      recordCancelledRef.current = true;
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current)
      clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setRecordLocked(false);
    setIsPaused(false);
    setRecordingSeconds(0);
    setSelectedOther(null);
    setMessages([]);
    setEditingId(null);
    setMsgSelectionMode(false);
    setSelectedMsgIds(new Set());
    setView("list");
  };

  // const openNewChat = () => {
  //   fetchAllAdmins();
  //   setAdminSearchQuery('');
  //   setView('newChat');
  // };

  const sendMessage = async (
    text: string | null,
    attachmentType?: string,
    attachmentData?: string,
  ) => {
    if (!user || !selectedOther) return;
    try {
      await fetch(`${API_URL}/api/admin-chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    setInput("");
    saveDraft(selectedOther.id, "");
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
    // Если micPressStartRef не был установлен (0) — считаем как короткий тап.
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
  const handleMicPointerCancel = () => {
    if (!isRecording || recordLocked) return;
    const held =
      micPressStartRef.current === 0
        ? 0
        : Date.now() - micPressStartRef.current;
    if (held < TAP_THRESHOLD_MS) {
      setTimeout(() => setRecordLocked(true), 50);
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

  // const handleDeleteOrHide = async (m: AdminMessage) => {
  //   if (!user || !selectedOther) return;
  //   const isMine = m.sender_id === user.id;

  //   if (isMine) {
  //     if (!confirm('Удалить это сообщение? Оно пропадёт у обеих сторон.')) return;
  //     try {
  //       await fetch(`${API_URL}/api/admin-chat/message/${m.id}`, {
  //         method: 'DELETE',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ userId: user.id }),
  //       });
  //       fetchThread(selectedOther.id);
  //     } catch (err) {
  //       console.error(err);
  //     }
  //   } else {
  //     if (!confirm('Скрыть это сообщение у себя? Собеседник продолжит видеть его как обычно.')) return;
  //     try {
  //       await fetch(`${API_URL}/api/admin-chat/hide/${m.id}`, {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ viewerId: user.id }),
  //       });
  //       fetchThread(selectedOther.id);
  //     } catch (err) {
  //       console.error(err);
  //     }
  //   }
  //   setRevealedId(null);
  // };

  // const handleStartEdit = (m: AdminMessage) => {
  //   setEditingId(m.id);
  //   setEditText(m.message || '');
  //   setRevealedId(null);
  // };

  const handleSaveEdit = async (id: number) => {
    if (!user || !editText.trim()) return;
    try {
      await fetch(`${API_URL}/api/admin-chat/message/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
  // const handleDeleteThread = async () => {
  //   if (!user || !selectedOther) return;
  //   if (
  //     !confirm(
  //       `Удалить переписку с ${selectedOther.username}? Она пропадёт только у вас.`,
  //     )
  //   )
  //     return;
  //   try {
  //     await fetch(
  //       `${API_URL}/api/admin-chat/thread/${user.id}/${selectedOther.id}`,
  //       { method: "DELETE" },
  //     );
  //     closeThread();
  //     fetchInbox();
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };

  // const handleDeleteThreadFromList = async (otherId: string, username: string, e: React.MouseEvent) => {
  //   e.stopPropagation();
  //   if (!user) return;
  //   if (!confirm(`Удалить переписку с ${username}? Она пропадёт только у вас.`)) return;
  //   try {
  //     await fetch(`${API_URL}/api/admin-chat/thread/${user.id}/${otherId}`, { method: 'DELETE' });
  //     fetchInbox();
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };

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
    openThread(
      item.otherId,
      item.username,
      item.adminPermissions,
      item.isMainAdmin,
    );
  };

  const exitListSelectionMode = () => {
    setListSelectionMode(false);
    setSelectedThreadIds(new Set());
    setShowThreadMenu(false);
  };

  const handleToggleSelectAllThreads = () => {
    const allSelected =
      visibleItems.length > 0 &&
      visibleItems.every((i) => selectedThreadIds.has(i.otherId));
    if (allSelected) {
      setSelectedThreadIds(new Set());
    } else {
      setSelectedThreadIds(new Set(visibleItems.map((i) => i.otherId)));
    }
  };

  const handleBulkDeleteThreads = async () => {
    if (!user || selectedThreadIds.size === 0) return;

    for (const otherId of selectedThreadIds) {
      try {
        await fetch(`${API_URL}/api/admin-chat/thread/${user.id}/${otherId}`, {
          method: "DELETE",
        });
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
    }, LONG_PRESS_MS);
  };

  const handleMsgClick = (m: AdminMessage) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (msgSelectionMode) {
      toggleMsgSelected(m.id);
    }
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

  const exitMsgSelectionMode = () => {
    setMsgSelectionMode(false);
    setSelectedMsgIds(new Set());
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
  // Править можно только своё текстовое сообщение без вложений.
  const canEditSelection =
    selectedMsgIds.size === 1 &&
    (() => {
      const id = Array.from(selectedMsgIds)[0];
      const m = messages.find((msg) => msg.id === id);
      return (
        !!m &&
        !!user &&
        m.sender_id === user.id &&
        !!m.message &&
        !m.attachment_type
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

  const handleToggleSelectAllMsgs = () => {
    const allSelected =
      messages.length > 0 && messages.every((m) => selectedMsgIds.has(m.id));
    if (allSelected) {
      setSelectedMsgIds(new Set());
    } else {
      setSelectedMsgIds(new Set(messages.map((m) => m.id)));
    }
  };

  // «Удалить у всех» — своё сообщение стирается из базы для обеих сторон.
  // Кнопка показывается только когда все выделенные сообщения свои, так
  // что чужих здесь не бывает; бэкенд всё равно проверяет sender_id.
  const handleConfirmDeleteAll = async () => {
    if (!user || !selectedOther) return;
    const toProcess = messages.filter((m) => selectedMsgIds.has(m.id));
    for (const m of toProcess) {
      try {
        await fetch(`${API_URL}/api/admin-chat/message/${m.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch (err) {
        console.error(err);
      }
    }
    setShowDeleteModal(false);
    exitMsgSelectionMode();
    fetchThread(selectedOther.id);
  };

  // «Удалить у меня» — стойкое скрытие: бэкенд сам решает, какой флаг
  // ставить (hidden_from_sender или hidden_from_recipient), исходя из
  // того, автор ты или получатель. Собеседник продолжает видеть.
  const handleConfirmDeleteForMe = async () => {
    if (!user || !selectedOther) return;
    const toProcess = messages.filter((m) => selectedMsgIds.has(m.id));
    for (const m of toProcess) {
      try {
        await fetch(`${API_URL}/api/admin-chat/hide/${m.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewerId: user.id }),
        });
      } catch (err) {
        console.error(err);
      }
    }
    setShowDeleteModal(false);
    exitMsgSelectionMode();
    fetchThread(selectedOther.id);
  };

  const isSearching = searchQuery.trim().length > 0;

  // В списке всегда все админы: у кого есть переписка — берём строку из
  // inbox (с последним сообщением и счётчиком непрочитанных), остальные
  // добавляются пустыми, чтобы можно было написать первым. Сортировка:
  // сначала активные переписки по свежести, потом остальные по имени.
  const visibleItems: InboxItem[] = (() => {
    const q = searchQuery.trim().toLowerCase();

    const all = allAdmins
      .filter(
        (a) =>
          !q ||
          a.id.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q),
      )
      .map((a) => {
        const existing = inbox.find((i) => i.otherId === a.id);
        return (
          existing ?? {
            otherId: a.id,
            username: a.username,
            adminPermissions: a.admin_permissions,
            isMainAdmin: a.is_main_admin,
            lastMessage: "",
            lastAt: "",
            unreadCount: 0,
          }
        );
      });

    return all.sort((a, b) => {
      if (a.lastAt && b.lastAt)
        return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
      if (a.lastAt) return -1;
      if (b.lastAt) return 1;
      return a.username.localeCompare(b.username);
    });
  })();

  const othersWithUnread = selectedOther
    ? inbox.filter(
        (item) => item.otherId !== selectedOther.id && item.unreadCount > 0,
      )
    : [];
  const otherUnread = othersWithUnread.reduce(
    (sum, item) => sum + item.unreadCount,
    0,
  );
  const latestOther = othersWithUnread.sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  )[0];

  // Баннер уведомления о новом сообщении от другого собеседника — общий.
  const renderOtherThreadBanner = () =>
    latestOther && (
      <button
        onClick={() =>
          openThread(
            latestOther.otherId,
            latestOther.username,
            latestOther.adminPermissions,
            latestOther.isMainAdmin,
          )
        }
        className="w-full mb-3 bg-amber-900 border border-amber-600/50 rounded-lg py-2.5 px-3 text-left hover:bg-amber-800 transition-colors shrink-0 shadow-lg shadow-black/40"
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-amber-400 text-xs font-semibold flex items-center gap-1.5">
            <BellIcon />
            {latestOther.username}
          </span>
          {otherUnread > 1 && (
            <span className="text-amber-500 text-[10px]">
              +{otherUnread - 1} ещё
            </span>
          )}
        </div>
        <p className="text-amber-300/80 text-xs truncate">
          {latestOther.lastMessage}
        </p>
      </button>
    );

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

        <div className="flex-1 overflow-y-auto px-4 py-3 opacity-40 pointer-events-none flex flex-col gap-2">
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

  // Строка "Выбрать все / Отмена" — только когда уже включён режим выбора.
  // Верхняя плашка режима выбора — подменяет обычную шапку чата, пока
  // выделены сообщения.
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
          onClick={handleToggleSelectAllMsgs}
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
  // Список сообщений — общий рендер для мобильной и десктопной версии.
  const renderMessages = () => (
    <>
      {messages.length === 0 && (
        <p className="text-slate-600 text-xs text-center py-6">
          Пока сообщений нет
        </p>
      )}
      {messages.map((m) => {
        const isMine = user ? m.sender_id === user.id : false;
        const isSelected = selectedMsgIds.has(m.id);
        const isMediaOnly = !!m.attachment_type && !m.message;
        return (
          <div
            key={m.id}
            onPointerDown={() => handleMsgPointerDown(m.id)}
            onPointerUp={clearLongPressTimer}
            onPointerLeave={clearLongPressTimer}
            onPointerCancel={clearLongPressTimer}
            onClick={() => handleMsgClick(m)}
            className={`w-full flex select-none cursor-pointer rounded-md px-1.5 py-1 transition-colors ${
              isMine ? "justify-end" : "justify-start"
            } ${isSelected ? "bg-indigo-500/15" : ""}`}
          >
            <div
              className={`max-w-[80%] w-fit rounded-lg text-sm relative transition-all ${
                isMediaOnly ? "" : "px-3 py-2"
              } ${
                isMediaOnly
                  ? "bg-transparent"
                  : isMine
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-200"
              } ${isSelected ? "brightness-75" : ""}`}
            >
              {m.attachment_type === "image" && (
                <img
                  src={getOptimizedUrl(
                    m.attachment_data!,
                    "w_480,q_auto,f_auto",
                  )}
                  alt="вложение"
                  onClick={(e) => {
                    if (longPressFiredRef.current) return;
                    if (msgSelectionMode) return;
                    e.stopPropagation();
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
                      handleMsgPointerDown(m.id);
                      (e.currentTarget as HTMLElement).style.pointerEvents =
                        "none";
                      setTimeout(() => {
                        const el = document.getElementById(
                          `audio-overlay-${m.id}`,
                        );
                        if (el) el.style.pointerEvents = "auto";
                      }, 0);
                    }}
                    onPointerUp={clearLongPressTimer}
                    onPointerCancel={clearLongPressTimer}
                  />
                </div>
              )}

              {m.message && <span>{renderMessageText(m.message)}</span>}
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

  // Модалка удаления выбранных сообщений. «Отмена» полностью выходит из
  // режима выбора, а не просто закрывает модалку.
  const renderDeleteModal = () => {
    if (!showDeleteModal) return null;
    const selectedMessages = messages.filter((m) => selectedMsgIds.has(m.id));
    const allOwn =
      selectedMessages.length > 0 &&
      !!user &&
      selectedMessages.every((m) => m.sender_id === user.id);

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

  // Поле ввода + эмодзи + запись голоса — общий рендер.
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
                  if (selectedOther)
                    saveDraft(selectedOther.id, e.target.value);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
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
                  onPointerCancel={handleMicPointerCancel}
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

  // Верхняя плашка режима выбора диалогов — подменяет заголовок списка,
  // пока что-то выделено.
  const renderThreadSelectionBar = () => (
    <div className="flex items-center justify-between mb-3 relative">
      <div className="flex items-center gap-3">
        <button
          onClick={exitListSelectionMode}
          className="text-slate-200 hover:text-white md:scale-125 md:origin-left"
          aria-label="Назад"
        >
          <BackArrowIcon />
        </button>
        <span className="text-slate-100 text-sm md:text-base font-medium">
          {selectedThreadIds.size}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowThreadDeleteModal(true)}
          className="text-red-400 hover:text-red-300 md:scale-125"
          aria-label="Удалить"
        >
          <TrashIcon />
        </button>
        <button
          onClick={() => setShowThreadMenu((v) => !v)}
          className="text-slate-300 hover:text-white md:scale-125"
          aria-label="Ещё"
        >
          <DotsIcon />
        </button>
      </div>

      {showThreadMenu && (
        <>
          {/* Клик мимо меню закрывает его */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowThreadMenu(false)}
          />
          <div className="absolute right-0 top-8 z-50 bg-slate-900 rounded-xl shadow-xl shadow-black/50 py-1 min-w-[180px] overflow-hidden">
            <button
              onClick={() => {
                handleToggleSelectAllThreads();
                setShowThreadMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 text-slate-200 text-sm hover:bg-slate-800 transition-colors"
            >
              {visibleItems.length > 0 &&
              visibleItems.every((i) => selectedThreadIds.has(i.otherId))
                ? "Снять выбор"
                : "Выбрать все"}
            </button>
            <button
              onClick={() => {
                setShowThreadMenu(false);
                setShowThreadDeleteModal(true);
              }}
              className="w-full text-left px-4 py-2.5 text-slate-200 text-sm hover:bg-slate-800 transition-colors"
            >
              {selectedThreadIds.size > 1 ? "Очистить чаты" : "Очистить чат"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  // Модалка удаления выбранных переписок — в стиле WhatsApp: вопрос
  // слева сверху, действия справа, без разделителей.
  const renderThreadDeleteModal = () => {
    if (!showThreadDeleteModal) return null;

    const handleCancel = () => setShowThreadDeleteModal(false);

    const handleConfirm = async () => {
      setShowThreadDeleteModal(false);
      await handleBulkDeleteThreads();
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
            {selectedThreadIds.size > 1
              ? `Удалить чаты (${selectedThreadIds.size})?`
              : "Удалить чат?"}
          </p>
          <div className="flex items-center justify-end gap-5">
            <button
              onClick={handleCancel}
              className="py-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              className="py-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
            >
              {selectedThreadIds.size > 1 ? "Удалить чаты" : "Удалить чат"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---- Экран списка диалогов ----
  if (view === "list") {
    return (
      <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5 h-[calc(100vh-180px)] md:h-[760px] flex flex-col">
        <div className="flex flex-col h-full min-h-0">
          {/* Фиксированная шапка: поиск + заголовок. Не уезжает при
              прокрутке списка чатов ниже. */}
          <div className="shrink-0">
            <div className="flex items-center gap-2.5 bg-slate-800 rounded-full px-4 py-2.5">
              <span className="text-slate-500 shrink-0">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск админов по id и по имени"
                className="flex-1 bg-transparent text-slate-100 text-sm outline-none min-w-0"
              />
            </div>

            <div className="mt-4">
              {listSelectionMode ? (
                renderThreadSelectionBar()
              ) : (
                <div className="flex items-center justify-center mb-3">
                  <span className="text-sm font-medium text-indigo-400">
                    {isSearching ? "Результаты поиска" : "Переписка с админами"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {visibleItems.length === 0 && (
            <p className="text-slate-600 text-xs text-center py-6">
              {isSearching
                ? "Никого не найдено"
                : "Других администраторов пока нет"}
            </p>
          )}

          {/* Прокручиваемый список чатов — на десктопе видно ~10 строк,
              на мобильном занимает всю оставшуюся высоту. */}
          <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto no-scrollbar pb-2">
            {visibleItems.map((item) => {
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
                    isSelected
                      ? "bg-indigo-950/40 ring-2 ring-indigo-500"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {listSelectionMode && (
                      <span
                        className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-indigo-500 text-white"
                            : "border-2 border-slate-600"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-slate-100 text-sm font-medium truncate">
                          {item.username}
                        </p>
                        <AccessBadge
                          permissions={item.adminPermissions}
                          isMainAdmin={item.isMainAdmin}
                        />
                      </div>
                      <p className="text-slate-500 text-xs truncate">
                        {item.lastMessage}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {item.unreadCount > 0 && (
                      <span className="bg-indigo-600 text-white text-xs font-medium rounded-full px-2 py-0.5">
                        {item.unreadCount}
                      </span>
                    )}
                    <span className="text-slate-600 text-xs font-mono">
                      {item.otherId}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {renderThreadDeleteModal()}
        </div>
      </div>
    );
  }

  // ---- Экран выбора нового собеседника ----
  // if (view === 'newChat') {
  //   return (
  //     <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
  //       <div className="flex items-center justify-between mb-4">
  //         <span className="text-sm font-medium text-indigo-400">Выберите администратора</span>
  //         <button onClick={() => setView('list')} className="text-slate-500 hover:text-slate-300 text-xs">
  //           ← Назад
  //         </button>
  //       </div>

  //       {allAdmins.length > 0 && (
  //         <input
  //           type="text"
  //           value={adminSearchQuery}
  //           onChange={(e) => setAdminSearchQuery(e.target.value)}
  //           placeholder="Поиск по ID или имени..."
  //           className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500 mb-3"
  //         />
  //       )}

  //       {allAdmins.length === 0 && (
  //         <p className="text-slate-600 text-xs text-center py-6">Других администраторов пока нет</p>
  //       )}

  //       {allAdmins.length > 0 && filteredAdmins.length === 0 && (
  //         <p className="text-slate-600 text-xs text-center py-6">Никого не найдено</p>
  //       )}

  //       <div className="flex flex-col gap-2">
  //         {filteredAdmins.map((admin) => (
  //           <button
  //             key={admin.id}
  //             onClick={() => openThread(admin.id, admin.username, admin.admin_permissions, admin.is_main_admin)}
  //             className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded-xl p-3 flex items-center gap-2 transition-colors"
  //           >
  //             <span className="text-slate-100 text-sm font-medium">{admin.username}</span>
  //             <AccessBadge permissions={admin.admin_permissions} isMainAdmin={admin.is_main_admin} />
  //           </button>
  //         ))}
  //       </div>
  //     </div>
  //   );
  // }

  // ---- Экран переписки ----
  if (view === "thread" && selectedOther && user) {
    return (
      <>
        {/* Мобильный: полноэкранный оверлей. Скрыт на md и шире. */}
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900 flex flex-col">
          {renderEditOverlay()}
          {msgSelectionMode ? (
            renderSelectionTopBar()
          ) : (
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
              <button
                onClick={closeThread}
                className="text-slate-300 hover:text-white text-xl leading-none px-1 -ml-1"
                aria-label="Назад"
              >
                ←
              </button>
              <div className="flex items-center gap-1.5 min-w-0 mx-2">
                <span className="text-slate-100 text-sm font-medium truncate">
                  {selectedOther.username}
                </span>
                <AccessBadge
                  permissions={selectedOther.adminPermissions}
                  isMainAdmin={selectedOther.isMainAdmin}
                />
              </div>
              <span className="w-6 shrink-0" />
            </div>
          )}
          <div className="relative flex-1 min-h-0">
            {latestOther && (
              <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-3">
                {renderOtherThreadBanner()}
              </div>
            )}
            <div
              className="h-full overflow-y-auto px-4 py-3 flex flex-col gap-2"
              ref={mobileMessagesContainerRef}
              onScroll={handleMessagesScroll}
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

        {/* Десктоп: встроенный блок фиксированной высоты, без оверлея. Видим только на md и шире. */}
        <div className="hidden md:flex w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5 h-[700px] flex-col relative">
          {renderEditOverlay()}
          {msgSelectionMode ? (
            <div className="-mx-5 -mt-5 mb-4">{renderSelectionTopBar()}</div>
          ) : (
            <div className="flex items-center justify-between mb-4 shrink-0">
              <button
                onClick={closeThread}
                className="text-slate-400 hover:text-slate-200 text-sm flex items-center"
                aria-label="Назад"
              >
                <BackArrowIcon />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-indigo-400">
                  {selectedOther.username}
                </span>
                <AccessBadge
                  permissions={selectedOther.adminPermissions}
                  isMainAdmin={selectedOther.isMainAdmin}
                />
              </div>
            </div>
          )}

          {renderOtherThreadBanner()}

          <div className="relative flex-1 min-h-0 mb-3">
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

        {renderDeleteModal()}
      </>
    );
  }

  return null;
};

export default AdminChatView;

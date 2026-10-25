import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Bot,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CirclePlay,
  CreditCard,
  Download,
  Expand,
  FileCheck2,
  GitBranch,
  Globe2,
  Landmark,
  Link2,
  LoaderCircle,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Unplug,
  Upload,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { World } from "./World";
import type { WorldHandle } from "./World";
import {
  catalog,
  connect,
  hasRevenuePath,
  limits,
  money,
  number,
  parseProject,
  removeBlock,
  seedProject,
  simulate,
  STORAGE_KEY,
} from "./model";
import type {
  Assumptions,
  BlockKind,
  BusinessBlock,
  Month,
  Project,
} from "./model";

const blockIcons = {
  acquisition: TrendingUp,
  audience: Users,
  product: Box,
  revenue: CreditCard,
  agent: Bot,
  finance: Landmark,
  legal: ShieldCheck,
};
type Tab = "model" | "economy" | "agents" | "integrations";
type ModalKind = "catalog" | "project" | "help" | "tbank" | "reset" | null;
const taxNote =
  "УСН «Доходы» 6% от выручки. Без уменьшения на взносы, НДС и других обязательств. Это сценарный расчёт, не бухгалтерская отчётность.";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      project: raw ? parseProject(raw) : structuredClone(seedProject),
      error: "",
    };
  } catch {
    return {
      project: structuredClone(seedProject),
      error:
        "Не удалось прочитать сохранение. Демомодель открыта без перезаписи прежних данных.",
    };
  }
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Закрыть окно"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max = 1000000,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, parsed))
      : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        {suffix && <span>{suffix}</span>}
      </div>
    </label>
  );
}

function Chart({ months }: { months: Month[] }) {
  const w = 700,
    h = 210,
    pad = 24;
  const values = months.flatMap((m) => [m.revenue, m.costs + m.tax, 0]);
  const max = Math.max(...values, 1) * 1.1;
  const xy = (value: number, i: number) =>
    `${pad + (i * (w - 2 * pad)) / 11},${h - pad - (value / max) * (h - pad * 2)}`;
  const line = months.map((m, i) => xy(m.revenue, i)).join(" ");
  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Прогноз месячной выручки и расходов с УСН на 12 месяцев"
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c6f77c" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#c6f77c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad}
            x2={w - pad}
            y1={h - pad - t * (h - 2 * pad)}
            y2={h - pad - t * (h - 2 * pad)}
            stroke="#2a333b"
            strokeDasharray="3 5"
          />
        ))}
        <polygon
          points={`${pad},${h - pad} ${line} ${w - pad},${h - pad}`}
          fill="url(#chart-fill)"
        />
        <polyline
          points={months.map((m, i) => xy(m.costs + m.tax, i)).join(" ")}
          fill="none"
          stroke="#c99e77"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <polyline
          points={line}
          fill="none"
          stroke="#c6f77c"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {months.map((m, i) => (
          <g key={m.month}>
            <circle
              cx={pad + (i * (w - 2 * pad)) / 11}
              cy={h - pad - (m.revenue / max) * (h - pad * 2)}
              r="3"
              fill="#c6f77c"
            >
              <title>{`Месяц ${m.month}: выручка ${money(m.revenue)}, расходы и УСН ${money(m.costs + m.tax)}`}</title>
            </circle>
            <text
              x={pad + (i * (w - 2 * pad)) / 11}
              y={h - 3}
              textAnchor="middle"
              fill="#78838d"
              fontSize="11"
            >
              {m.month} мес.
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function App() {
  const [initial] = useState(load);
  const [project, setProject] = useState(initial.project);
  const [storageError, setStorageError] = useState(initial.error);
  const [pauseSave, setPauseSave] = useState(!!initial.error);
  const [tab, setTab] = useState<Tab>("model");
  const [selected, setSelected] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<Project[]>([]);
  const [ran, setRan] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [month, setMonth] = useState(6);
  const [target, setTarget] = useState("");
  const [analysis, setAnalysis] = useState(false);
  const [busyAgent, setBusyAgent] = useState(false);
  const worldRef = useRef<WorldHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const model = useMemo(() => simulate(project), [project]);
  const snapshot = model[month - 1];
  const block = project.blocks.find((b) => b.id === selected);
  const connected = hasRevenuePath(project);
  const fixed = project.blocks.reduce((s, b) => s + b.cost, 0);

  useEffect(() => {
    if (pauseSave) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setStorageError("");
    } catch {
      setStorageError(
        "Браузер не сохранил проект. Экспортируйте JSON, чтобы не потерять изменения.",
      );
    }
  }, [project, pauseSave]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    setTarget("");
  }, [selected]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConnecting(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  function update(next: Project) {
    if (next === project) return;
    setHistory((h) => [...h.slice(-29), project]);
    setProject(next);
    setRan(false);
    setAnalysis(false);
  }
  function undo() {
    const last = history.at(-1);
    if (!last) return;
    setProject(last);
    setHistory((h) => h.slice(0, -1));
    setSelected(null);
    setConnecting(false);
    setRan(false);
    setAnalysis(false);
    setNotice("Последнее изменение отменено");
  }
  function setAssumption(key: keyof Assumptions, value: number) {
    const [min, max] = limits[key];
    update({
      ...project,
      assumptions: {
        ...project.assumptions,
        [key]: Math.max(min, Math.min(max, value)),
      },
    });
  }
  function editBlock(patch: Partial<BusinessBlock>) {
    update({
      ...project,
      blocks: project.blocks.map((b) =>
        b.id === selected ? { ...b, ...patch } : b,
      ),
    });
  }
  function select(id: string) {
    if (connecting && selected) {
      if (id === selected) {
        setNotice("Выберите другой блок для связи");
        return;
      }
      const next = connect(project, selected, id);
      if (next === project) setNotice("Такая связь уже существует");
      else {
        update(next);
        setNotice("Направленная связь добавлена");
      }
      setConnecting(false);
    } else setSelected(id);
  }
  function addBlock(kind: BlockKind) {
    if (project.blocks.length >= 30) {
      setNotice("В одном проекте может быть до 30 блоков");
      return;
    }
    const id = crypto.randomUUID();
    let x = 0,
      z = 4;
    outer: for (let row = -6; row <= 6; row += 3)
      for (let col = -6; col <= 6; col += 3) {
        if (
          project.blocks.every((b) => Math.hypot(b.x - col, b.z - row) > 2.2)
        ) {
          x = col;
          z = row;
          break outer;
        }
      }
    update({
      ...project,
      blocks: [
        ...project.blocks,
        { id, kind, name: catalog[kind].title, cost: catalog[kind].cost, x, z },
      ],
    });
    setSelected(id);
    setModal(null);
    setQuery("");
    setTab("model");
    setNotice("Блок добавлен. Настройте его и создайте связи.");
  }
  function run() {
    if (!connected) {
      setNotice(
        "Для симуляции выручки соедините: Привлечение → Аудитория → SaaS-продукт → Подписка",
      );
      return;
    }
    setSimulating(true);
    timers.current.push(
      setTimeout(() => {
        setSimulating(false);
        setRan(true);
        setTab("economy");
        setNotice("Сценарий на 12 месяцев рассчитан");
      }, 500),
    );
  }
  function exportProject() {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "astra-project.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Проект экспортирован в JSON");
  }
  async function importProject(file?: File) {
    if (!file) return;
    try {
      if (file.size > 200000)
        throw new Error("Файл слишком большой. Максимум — 200 КБ.");
      const next = parseProject(await file.text());
      update(next);
      setPauseSave(false);
      setSelected(null);
      setConnecting(false);
      setModal(null);
      setNotice(
        "Проект импортирован. Прежнюю модель можно вернуть кнопкой отмены.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Не удалось импортировать проект",
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  const field = (
    key: keyof Assumptions,
    label: string,
    suffix: string,
    step = 1,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={project.assumptions[key]}
      onChange={(v) => setAssumption(key, v)}
      suffix={suffix}
      min={limits[key][0]}
      max={limits[key][1]}
      step={step}
    />
  );

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Главная навигация">
        <button
          className="brand"
          onClick={() => setTab("model")}
          aria-label="ASTRA — главная"
        >
          <span>A</span>
          <i />
        </button>
        <div className="rail-nav">
          {(
            [
              ["model", Blocks, "Конструктор"],
              ["economy", Activity, "Экономика"],
              ["agents", Bot, "Агенты"],
              ["integrations", Unplug, "Подключения"],
            ] as const
          ).map(([id, Icon, title]) => (
            <button
              key={id}
              className={`rail-button ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
              title={title}
              aria-label={title}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={21} />
              <span>{title}</span>
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            onClick={() => setModal("help")}
            aria-label="Как пользоваться"
            title="Как пользоваться"
          >
            <CircleHelp size={21} />
          </button>
          <button
            className="avatar"
            onClick={() => setModal("project")}
            aria-label="Настройки проекта"
          >
            Я
          </button>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumbs">
            <span className="wordmark">
              ASTRA<span> / </span>
            </span>
            <span className="workspace-name">Личное пространство</span>
            <ChevronRight size={14} />
            <button
              className="project-select"
              onClick={() => setModal("project")}
            >
              {project.name}
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="header-actions">
            <span className={`save-status ${storageError ? "warning" : ""}`}>
              <span className="status-dot" />
              {storageError ? "Не сохранено" : "Сохранено в браузере"}
            </span>
            <button className="button quiet small" onClick={exportProject}>
              <Download size={15} />
              <span>Экспорт</span>
            </button>
          </div>
        </header>

        <main>
          {storageError && (
            <div className="storage-warning" role="alert">
              {storageError}
              {pauseSave && (
                <button
                  onClick={() => {
                    setPauseSave(false);
                    setStorageError("");
                  }}
                >
                  Сохранять текущую модель
                </button>
              )}
            </div>
          )}
          <section className="intro">
            <div>
              <div className="eyebrow">
                <span /> ВАША БИЗНЕС-ЛАБОРАТОРИЯ
              </div>
              <h1>
                Большие идеи. <span>Реальные системы.</span>
              </h1>
              <p>
                Собирайте бизнес из блоков. Проверяйте гипотезы. Находите точки
                роста.
              </p>
            </div>
            <div className="sandbox-badge">
              <span className="sandbox-icon">
                <Box size={19} />
              </span>
              <div>
                <b>Режим симуляции</b>
                <span>Россия · ₽ · УСН 6%</span>
              </div>
            </div>
          </section>

          <div className="workspace-toolbar">
            <nav className="tabs" aria-label="Разделы проекта">
              {(
                [
                  ["model", GitBranch, "Конструктор"],
                  ["economy", TrendingUp, "Экономика"],
                  ["agents", Sparkles, "Агенты"],
                  ["integrations", Link2, "Подключения"],
                ] as const
              ).map(([id, Icon, title]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={tab === id ? "active" : ""}
                >
                  <Icon size={16} />
                  {title}
                  {id === "agents" && <span className="count">3</span>}
                </button>
              ))}
            </nav>
            <div className="toolbar-actions">
              <button
                className="icon-button"
                onClick={undo}
                disabled={!history.length}
                title="Отменить изменение"
                aria-label="Отменить изменение"
              >
                <RotateCcw size={17} />
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setQuery("");
                  setModal("catalog");
                }}
              >
                <Plus size={17} />
                Добавить блок
              </button>
            </div>
          </div>

          {tab === "model" && (
            <div className="builder-layout">
              <section className="map-panel" aria-label="Конструктор модели">
                <div className="map-heading">
                  <div>
                    <span className="live-dot" /> <b>Карта бизнеса</b>
                    <span className="map-meta">
                      {project.blocks.length} блоков ·{" "}
                      {project.connections.length} связей
                    </span>
                  </div>
                  <span className="dimension-tag">3D WORKSPACE</span>
                </div>
                <World
                  ref={worldRef}
                  project={project}
                  selected={selected}
                  connecting={connecting}
                  onSelect={select}
                  onMove={(id, x, z) =>
                    update({
                      ...project,
                      blocks: project.blocks.map((b) =>
                        b.id === id ? { ...b, x, z } : b,
                      ),
                    })
                  }
                />
                {connecting && (
                  <div className="connect-banner">
                    <Link2 size={15} />
                    Выберите блок назначения
                    <button
                      onClick={() => setConnecting(false)}
                      aria-label="Отменить создание связи"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {!project.blocks.length && (
                  <div className="empty-map">
                    <Blocks size={36} />
                    <h2>Здесь начинается ваш бизнес</h2>
                    <p>Добавьте первый блок и соберите модель.</p>
                    <button
                      className="button primary"
                      onClick={() => setModal("catalog")}
                    >
                      Добавить блок
                    </button>
                  </div>
                )}
                <div className="map-bottom">
                  <span>
                    <MousePointer2 size={13} />
                    Перетаскивайте блоки · колесо — масштаб
                  </span>
                  <div className="zoom-controls">
                    <button
                      onClick={() => worldRef.current?.zoom(-1)}
                      aria-label="Уменьшить масштаб"
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      onClick={() => worldRef.current?.reset()}
                      aria-label="Сбросить масштаб"
                    >
                      <Expand size={15} />
                    </button>
                    <button
                      onClick={() => worldRef.current?.zoom(1)}
                      aria-label="Увеличить масштаб"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </section>

              <aside className="inspector">
                {block ? (
                  <>
                    <div className="inspector-heading">
                      <span>
                        <Settings2 size={16} />
                        Параметры блока
                      </span>
                      <button
                        className="icon-button"
                        onClick={() => {
                          setSelected(null);
                          setConnecting(false);
                        }}
                        aria-label="Закрыть параметры"
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="block-title">
                      <BlockIcon kind={block.kind} />
                      <div>
                        <h2>{catalog[block.kind].title}</h2>
                        <span>{catalog[block.kind].category} · модель</span>
                      </div>
                    </div>
                    <div className="inspector-scroll">
                      <label className="field">
                        <span>Название</span>
                        <input
                          value={block.name}
                          maxLength={60}
                          onChange={(e) =>
                            editBlock({
                              name: e.target.value || catalog[block.kind].title,
                            })
                          }
                        />
                      </label>
                      <NumberField
                        label="Постоянные расходы"
                        value={block.cost}
                        onChange={(v) => editBlock({ cost: v })}
                        suffix="₽ / мес."
                        step={100}
                      />
                      {block.kind === "audience" && (
                        <>
                          {field("visitors", "Посетители в месяц", "чел.")}
                          {field("conversion", "Конверсия в оплату", "%", 0.1)}
                        </>
                      )}
                      {block.kind === "acquisition" &&
                        field("visitors", "Посетители в месяц", "чел.")}
                      {block.kind === "revenue" && (
                        <>
                          {field("price", "Цена подписки", "₽ / мес.", 100)}
                          {field("churn", "Ежемесячный отток", "%", 0.1)}
                        </>
                      )}
                      {block.kind === "product" &&
                        field(
                          "variableCost",
                          "Расходы на клиента",
                          "₽ / мес.",
                          10,
                        )}
                      {["agent", "legal", "finance"].includes(block.kind) && (
                        <p className="inline-note">
                          {block.kind === "agent"
                            ? "Блок учитывает бюджет. Настоящий ИИ-сервис пока не подключён."
                            : block.kind === "finance"
                              ? "Блок учитывает расходы на бухгалтерию. Учёт и сдача отчётности пока не подключены."
                              : "Блок учитывает юридический бюджет. Договоры и правовая проверка пока не подключены."}
                        </p>
                      )}
                      <div className="section-label">ИСХОДЯЩИЕ СВЯЗИ</div>
                      <div className="edge-list">
                        {project.connections
                          .filter((e) => e.from === block.id)
                          .map((e) => (
                            <div key={e.to}>
                              <ArrowUpRight size={14} />
                              <span>
                                {
                                  project.blocks.find((b) => b.id === e.to)
                                    ?.name
                                }
                              </span>
                              <button
                                aria-label={`Удалить связь с ${project.blocks.find((b) => b.id === e.to)?.name}`}
                                onClick={() =>
                                  update({
                                    ...project,
                                    connections: project.connections.filter(
                                      (c) => c !== e,
                                    ),
                                  })
                                }
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        {!project.connections.some(
                          (e) => e.from === block.id,
                        ) && <p className="muted">Нет исходящих связей</p>}
                      </div>
                      <div className="link-form">
                        <select
                          aria-label="Блок назначения"
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                        >
                          <option value="">Выберите блок…</option>
                          {project.blocks
                            .filter(
                              (b) =>
                                b.id !== block.id &&
                                !project.connections.some(
                                  (e) => e.from === block.id && e.to === b.id,
                                ),
                            )
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                        </select>
                        <button
                          className="icon-button"
                          disabled={!target}
                          aria-label="Добавить выбранную связь"
                          onClick={() => {
                            update(connect(project, block.id, target));
                            setTarget("");
                            setNotice("Связь добавлена");
                          }}
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                      <button
                        className={`button secondary full ${connecting ? "highlight" : ""}`}
                        onClick={() => setConnecting(!connecting)}
                      >
                        <Link2 size={15} />
                        {connecting ? "Отменить выбор" : "Соединить на карте"}
                      </button>
                    </div>
                    <button
                      className="delete-block"
                      onClick={() => {
                        update(removeBlock(project, block.id));
                        setSelected(null);
                        setConnecting(false);
                        setNotice("Блок удалён. Изменение можно отменить.");
                      }}
                    >
                      <Trash2 size={14} />
                      Удалить блок
                    </button>
                  </>
                ) : (
                  <>
                    <div className="inspector-heading">
                      <span>
                        <Zap size={16} />
                        Центр управления
                      </span>
                      <span className="tiny-tag">LAB</span>
                    </div>
                    <div className="control-body">
                      <div className="orbit-illustration">
                        <div className="orbit-ring ring-one" />
                        <div className="orbit-ring ring-two" />
                        <div className="orbit-center">
                          <Blocks size={31} />
                        </div>
                        <span className="satellite satellite-one">
                          <Check size={12} />
                        </span>
                        <span className="satellite satellite-two">
                          <Sparkles size={13} />
                        </span>
                      </div>
                      <h2>
                        {connected
                          ? "Ваша идея обретает форму"
                          : "Постройте путь к выручке"}
                      </h2>
                      <p>
                        Каждый блок — часть бизнеса.
                        <br />
                        Соедините их в работающую систему.
                      </p>
                      <div
                        className={`readiness ${connected ? "" : "incomplete"}`}
                      >
                        <span>
                          {connected ? (
                            <CheckCheck size={17} />
                          ) : (
                            <GitBranch size={17} />
                          )}
                          {connected
                            ? "Цепочка продаж собрана"
                            : "Цепочка продаж не завершена"}
                        </span>
                        <small>
                          Привлечение → аудитория → продукт → подписка
                        </small>
                      </div>
                      <button
                        className="button primary full run-button"
                        onClick={run}
                        disabled={simulating}
                      >
                        {simulating ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <CirclePlay size={17} />
                        )}
                        {simulating ? "Рассчитываем…" : "Запустить симуляцию"}
                        <ArrowRight size={16} />
                      </button>
                      <span className="run-caption">
                        12 месяцев · на основе ваших допущений
                      </span>
                      <div className="next-step">
                        <span className="section-label">СЛЕДУЮЩИЙ ШАГ</span>
                        <button
                          onClick={() => {
                            setTab("agents");
                          }}
                        >
                          <span className="mini-icon">
                            <Sparkles size={17} />
                          </span>
                          <span>
                            <b>Взгляд со стороны</b>
                            <small>Проверьте модель с ассистентами</small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </aside>
            </div>
          )}

          {tab === "economy" && (
            <section className="economy-layout">
              <div className="panel forecast-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">СЦЕНАРНЫЙ ПРОГНОЗ</span>
                    <h2>Экономика вашего бизнеса</h2>
                  </div>
                  <span className="pill">
                    <span className="status-dot" />
                    {ran ? "Симуляция рассчитана" : "Предварительный расчёт"}
                  </span>
                </div>
                {!connected && (
                  <div className="inline-warning">
                    Нет полной цепочки продаж. Выручка равна нулю; расходы
                    продолжают учитываться.
                  </div>
                )}
                <div className="chart-head">
                  <div>
                    <span>Выручка на {month}-й месяц</span>
                    <strong>{money(snapshot.revenue)}</strong>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i />
                      Выручка
                    </span>
                    <span>
                      <i />
                      Расходы + УСН
                    </span>
                  </div>
                </div>
                <Chart months={model} />
                <div className="timeline">
                  <label htmlFor="month">
                    Горизонт прогноза <b>{month} мес.</b>
                  </label>
                  <input
                    id="month"
                    type="range"
                    min="1"
                    max="12"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  />
                  <div>
                    <span>1 месяц</span>
                    <span>12 месяцев</span>
                  </div>
                </div>
                <div className="finance-breakdown">
                  <div>
                    <span>Операционные расходы</span>
                    <b>{money(snapshot.costs)}</b>
                  </div>
                  <div>
                    <span>УСН 6% за месяц</span>
                    <b>{money(snapshot.tax)}</b>
                  </div>
                  <div>
                    <span>Прибыль модели</span>
                    <b
                      className={
                        snapshot.profit >= 0 ? "text-lime" : "text-orange"
                      }
                    >
                      {money(snapshot.profit)}
                    </b>
                  </div>
                  <div>
                    <span>Денежный остаток</span>
                    <b className={snapshot.balance < 0 ? "text-orange" : ""}>
                      {money(snapshot.balance)}
                    </b>
                  </div>
                </div>
                <p className="disclaimer">
                  <FileCheck2 size={15} />
                  {taxNote}
                </p>
                <details className="methodology">
                  <summary>Как устроена симуляция</summary>
                  <p>
                    Каждый месяц: клиенты = клиенты прошлого месяца × (1 −
                    отток) + посетители × конверсия. Новые клиенты оплачивают
                    полный месяц. Выручка = клиенты × цена. Прибыль = выручка −
                    постоянные расходы всех блоков − расходы на клиента − 6%
                    выручки. Остаток = начальный капитал + накопленная прибыль.
                  </p>
                  <p>
                    Параметры воронки общие для проекта; несколько одинаковых
                    блоков не умножают поток клиентов. Расходы суммируются даже
                    у несвязанных блоков. Эквайринг включайте в расходы
                    самостоятельно. Число клиентов в расчёте дробное: это
                    математическое ожидание. Сезонность, возвраты, задержки
                    выплат и лимиты налоговых режимов не моделируются.
                  </p>
                </details>
              </div>
              <aside className="panel assumptions">
                <div className="inspector-heading">
                  <span>
                    <Settings2 size={16} />
                    Допущения модели
                  </span>
                </div>
                <div className="assumptions-fields">
                  {field("visitors", "Посетители в месяц", "чел.")}
                  {field("conversion", "Конверсия в оплату", "%", 0.1)}
                  {field("price", "Цена подписки", "₽ / мес.", 100)}
                  {field("churn", "Ежемесячный отток", "%", 0.1)}
                  {field("initialCustomers", "Клиенты на старте", "чел.")}
                  {field("variableCost", "Расходы на клиента", "₽ / мес.", 10)}
                  {field("cash", "Стартовый капитал", "₽", 10000)}
                  <p className="inline-note">
                    Постоянные расходы: {money(fixed)} / мес. Меняются в
                    параметрах блоков.
                  </p>
                </div>
              </aside>
            </section>
          )}

          {tab === "agents" && (
            <section className="agents-section">
              <div className="section-intro">
                <div>
                  <span className="eyebrow">ВАША КОМАНДА</span>
                  <h2>Три взгляда на одну большую идею</h2>
                  <p>
                    Локальные помощники проверяют допущения по заданным
                    правилам. Внешняя ИИ-модель пока не подключена.
                  </p>
                </div>
                <button
                  className="button primary"
                  disabled={busyAgent}
                  onClick={() => {
                    setBusyAgent(true);
                    timers.current.push(
                      setTimeout(() => {
                        setAnalysis(true);
                        setBusyAgent(false);
                      }, 450),
                    );
                  }}
                >
                  {busyAgent ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {busyAgent ? "Проверяем…" : "Проверить модель"}
                </button>
              </div>
              <div className="agent-grid">
                <AgentCard
                  color="lime"
                  icon={<TrendingUp />}
                  name="Стратег"
                  role="Рост и unit-экономика"
                  description="Проверяет цену, маржу и устойчивость модели."
                  active={analysis}
                  findings={
                    analysis
                      ? [
                          connected
                            ? "Цепочка продаж связана: можно оценивать выручку."
                            : "Не хватает связанной цепочки продаж — выручка равна нулю.",
                          project.assumptions.price * 0.94 >
                          project.assumptions.variableCost
                            ? "Доход на клиента покрывает переменные расходы и УСН."
                            : "Цена не покрывает переменные расходы и УСН.",
                          project.assumptions.churn > 5
                            ? "Отток выше 5%: проверьте сценарий удержания."
                            : "Сравните результат со сценарием роста оттока.",
                        ]
                      : []
                  }
                />
                <AgentCard
                  color="purple"
                  icon={<Wallet />}
                  name="Финансист"
                  role="Расходы и запас прочности"
                  description="Считает остаток денег и ищет кассовые разрывы."
                  active={analysis}
                  findings={
                    analysis
                      ? [
                          `Постоянные расходы: ${money(fixed)} в месяц.`,
                          model.some((m) => m.balance < 0)
                            ? `Деньги заканчиваются на ${model.find((m) => m.balance < 0)!.month}-м месяце.`
                            : "При заданных допущениях денег хватает на 12 месяцев.",
                          `УСН за 12 месяцев в модели: ${money(model.reduce((s, m) => s + m.tax, 0))}.`,
                        ]
                      : []
                  }
                />
                <AgentCard
                  color="blue"
                  icon={<ShieldCheck />}
                  name="Контролёр"
                  role="Готовность к реальному запуску"
                  description="Напоминает о платежах, данных и операционных рисках."
                  active={analysis}
                  findings={
                    analysis
                      ? [
                          "Эквайринг Т-Банка ещё не подключён к приложению.",
                          "До запуска нужны оферта, согласия и работа с персональными данными.",
                          "Проверьте применимость 54-ФЗ, кассу и чеки с бухгалтером.",
                        ]
                      : []
                  }
                />
              </div>
              {analysis && (
                <div className="scenario-card">
                  <div className="scenario-symbol">
                    <GitBranch size={24} />
                  </div>
                  <div>
                    <span className="eyebrow">ЭКСПЕРИМЕНТ</span>
                    <h3>Что, если снизить отток на 1 п. п.?</h3>
                    <p>
                      На 12-й месяц выручка составит{" "}
                      {money(
                        simulate({
                          ...project,
                          assumptions: {
                            ...project.assumptions,
                            churn: Math.max(0, project.assumptions.churn - 1),
                          },
                        })[11].revenue,
                      )}
                      . Это гипотеза, а не обещание роста.
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    disabled={project.assumptions.churn === 0}
                    onClick={() => {
                      setAssumption(
                        "churn",
                        Math.max(0, project.assumptions.churn - 1),
                      );
                      setNotice(
                        "Сценарий применён: отток снижен на 1 п. п. Можно отменить.",
                      );
                    }}
                  >
                    Применить сценарий
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              <div className="agent-footnote">
                <ShieldCheck size={16} />
                Помощники не отправляют данные, не тратят деньги и не действуют
                от вашего имени.
              </div>
            </section>
          )}

          {tab === "integrations" && (
            <section className="integrations-section">
              <div className="section-intro">
                <div>
                  <span className="eyebrow">ОТ МОДЕЛИ К БИЗНЕСУ</span>
                  <h2>Подключения к реальному миру</h2>
                  <p>
                    Ваш контекст: Россия, эквайринг Т-Банка и УСН «Доходы» 6%.
                  </p>
                </div>
                <span className="pill">
                  <Globe2 size={14} />
                  Работаем локально
                </span>
              </div>
              <div className="integration-grid">
                <div className="integration-card featured">
                  <div className="integration-top">
                    <div className="tbank-logo">Т</div>
                    <span className="pill amber">Не подключён</span>
                  </div>
                  <h3>Т-Банк</h3>
                  <p>
                    Ваш эквайринг для оплаты SaaS-подписок. Терминал у вас уже
                    есть; приложение пока не связано с банком.
                  </p>
                  <div className="integration-tags">
                    <span>Эквайринг</span>
                    <span>Россия</span>
                    <span>Рубли</span>
                  </div>
                  <button
                    className="button secondary full"
                    onClick={() => setModal("tbank")}
                  >
                    План подключения
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="integration-card">
                  <div className="integration-top">
                    <div className="integration-icon">
                      <Landmark size={24} />
                    </div>
                    <span className="pill">В модели</span>
                  </div>
                  <h3>Налоги и бухгалтерия</h3>
                  <p>
                    УСН 6% учитывается в прогнозе. Банковские выписки, первичные
                    документы и отчётность пока не импортируются.
                  </p>
                  <div className="integration-tags">
                    <span>УСН 6%</span>
                    <span>Без отчётности</span>
                  </div>
                  <button
                    className="button quiet full"
                    onClick={() => setTab("economy")}
                  >
                    Открыть расчёт
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="integration-card">
                  <div className="integration-top">
                    <div className="integration-icon">
                      <Bot size={24} />
                    </div>
                    <span className="pill">Локальные правила</span>
                  </div>
                  <h3>ИИ и автоматизация</h3>
                  <p>
                    Сейчас доступны проверки экономики по правилам. Выбор
                    ИИ-провайдера, память и выполнение задач — следующий этап.
                  </p>
                  <div className="integration-tags">
                    <span>Без API-ключей</span>
                    <span>Ручное применение</span>
                  </div>
                  <button
                    className="button quiet full"
                    onClick={() => setTab("agents")}
                  >
                    Открыть помощников
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              <div className="integration-note">
                <ShieldCheck size={22} />
                <div>
                  <h3>Сначала — прозрачный контроль</h3>
                  <p>
                    Для реальной работы добавим сервер, учёт пользователей,
                    журнал действий и подтверждение финансовых операций. Секреты
                    банка не должны попадать в браузер или файл проекта.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section
            className="metrics"
            aria-label={`Показатели модели на ${month}-й месяц`}
          >
            <Metric
              icon={<Wallet size={17} />}
              label="Месячная выручка"
              value={money(snapshot.revenue)}
              detail={`MRR · прогноз на ${month}-й месяц`}
              positive
            />
            <Metric
              icon={<Users size={17} />}
              label="Платящие клиенты"
              value={number(snapshot.customers)}
              detail={`${number((project.assumptions.visitors * project.assumptions.conversion) / 100)} новых в месяц по модели`}
            />
            <Metric
              icon={<TrendingUp size={17} />}
              label="Прибыль модели"
              value={money(snapshot.profit)}
              detail="После расходов и УСН 6%"
              positive={snapshot.profit >= 0}
            />
            <Metric
              icon={<GitBranch size={17} />}
              label="Система бизнеса"
              value={`${project.blocks.length.toString().padStart(2, "0")}`}
              detail={`${project.connections.length} связей · ${connected ? "воронка собрана" : "воронка не завершена"}`}
            />
          </section>
          <footer className="page-footer">
            <span>
              <span className="status-dot" />
              Лаборатория готова к экспериментам
            </span>
            <span>
              ASTRA / VENTURE LAB <span className="footer-version">v0.1</span>
            </span>
          </footer>
        </main>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Импорт JSON проекта"
        onChange={(e) => void importProject(e.target.files?.[0])}
      />
      {notice && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Закрыть уведомление"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {modal === "catalog" && (
        <Modal
          title="Из чего состоит ваш бизнес?"
          wide
          onClose={() => setModal(null)}
        >
          <p className="modal-subtitle">
            Выберите функциональный блок. Его расходы сразу попадут в модель.
          </p>
          <label className="search-field">
            <Search size={17} />
            <input
              placeholder="Найти блок…"
              aria-label="Поиск блоков"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="catalog-grid">
            {(
              Object.entries(catalog) as [
                BlockKind,
                (typeof catalog)[BlockKind],
              ][]
            )
              .filter(([, item]) =>
                `${item.title} ${item.description}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map(([kind, item]) => (
                <button
                  className="catalog-card"
                  key={kind}
                  onClick={() => addBlock(kind)}
                >
                  <div>
                    <BlockIcon kind={kind} />
                    <span className="catalog-plus">
                      <Plus size={17} />
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <span className="catalog-cost">
                    {money(item.cost)} / мес. <span>· можно изменить</span>
                  </span>
                </button>
              ))}
          </div>
          {!Object.values(catalog).some((item) =>
            `${item.title} ${item.description}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          ) && (
            <p className="empty-search">
              Блоки не найдены. Попробуйте другой запрос.
            </p>
          )}
          <p className="modal-footnote">
            До 30 блоков в одном проекте. Все подключения пока моделируются.
          </p>
        </Modal>
      )}
      {modal === "project" && (
        <Modal title="Ваш проект" onClose={() => setModal(null)}>
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const name = String(data.get("name")).trim();
              if (name) {
                update({ ...project, name });
                setModal(null);
              }
            }}
          >
            <label className="field">
              <span>Название проекта</span>
              <input
                name="name"
                defaultValue={project.name}
                maxLength={80}
                required
              />
            </label>
            <p className="inline-note">
              Проект хранится только в этом браузере. Экспортируйте его для
              резервной копии или переноса на другое устройство.
            </p>
            <button type="submit" className="button primary full">
              Сохранить название
            </button>
          </form>
          <div className="project-file-actions">
            <button className="button secondary" onClick={exportProject}>
              <ArrowDownToLine size={16} />
              Экспорт JSON
            </button>
            <button
              className="button secondary"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={16} />
              Импорт JSON
            </button>
          </div>
          <button className="delete-block" onClick={() => setModal("reset")}>
            <RotateCcw size={15} />
            Восстановить демомодель
          </button>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="Восстановить демомодель?" onClose={() => setModal(null)}>
          <p className="modal-subtitle">
            Текущий проект будет заменён примером. Экспортируйте его, если
            хотите сохранить копию. После замены доступна отмена.
          </p>
          <div className="project-file-actions">
            <button className="button secondary" onClick={exportProject}>
              <Download size={16} />
              Экспорт
            </button>
            <button
              className="button primary"
              onClick={() => {
                update(structuredClone(seedProject));
                setPauseSave(false);
                setSelected(null);
                setConnecting(false);
                setModal(null);
                setNotice("Демомодель восстановлена");
              }}
            >
              Восстановить
            </button>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="Ваша первая бизнес-модель" onClose={() => setModal(null)}>
          <div className="help-steps">
            {[
              [
                "01",
                "Соберите систему",
                "Добавляйте блоки из библиотеки. Перетаскивайте их на трёхмерной карте.",
              ],
              [
                "02",
                "Создайте связи",
                "Выберите блок → «Соединить на карте» → блок назначения. Для выручки нужна цепочка: привлечение → аудитория → продукт → подписка.",
              ],
              [
                "03",
                "Проверьте экономику",
                "Настройте цену, трафик, конверсию и расходы. Запустите симуляцию и сравните сценарии.",
              ],
              [
                "04",
                "Сохраните результат",
                "Изменения сохраняются в браузере. Экспорт JSON — ваша переносимая резервная копия.",
              ],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="inline-note">
            Демонстрационная лаборатория: платежи, внешние ИИ-сервисы,
            юридические действия и бухгалтерская отчётность не выполняются.
          </p>
          <button
            className="button primary full"
            onClick={() => setModal(null)}
          >
            Начать эксперимент
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {modal === "tbank" && (
        <Modal
          title="Подключение эквайринга Т-Банка"
          onClose={() => setModal(null)}
        >
          <div className="connection-state">
            <div className="tbank-logo">Т</div>
            <div>
              <b>Эквайринг у вас уже есть</b>
              <span>Интеграция с ASTRA ещё не реализована</span>
            </div>
          </div>
          <ol className="connection-steps">
            <li>
              <b>Сервер и защищённые настройки</b>
              <span>
                TerminalKey и пароль терминала хранятся только на сервере. Не
                вводите их в чат или JSON проекта.
              </span>
            </li>
            <li>
              <b>Тестовый платёж</b>
              <span>
                Создание заказа, переход на платёжную форму, проверка подписи
                уведомлений и повторных событий.
              </span>
            </li>
            <li>
              <b>Подписки и чеки</b>
              <span>
                Проверка доступности рекуррентных платежей, согласий клиента,
                возвратов и фискализации для вашего договора.
              </span>
            </li>
            <li>
              <b>Сверка и запуск</b>
              <span>
                Сопоставление заказов, выплат и комиссий, журнал операций; затем
                отдельное включение рабочего терминала.
              </span>
            </li>
          </ol>
          <p className="inline-note">
            Сейчас это план следующего этапа. Настоящие запросы в банк не
            отправляются.
          </p>
          <button
            className="button primary full"
            onClick={() => setModal(null)}
          >
            Понятно
          </button>
        </Modal>
      )}
    </div>
  );
}

function BlockIcon({ kind }: { kind: BlockKind }) {
  const Icon = blockIcons[kind];
  return (
    <span
      className="block-icon"
      style={{ "--block-color": catalog[kind].color } as React.CSSProperties}
    >
      <Icon size={21} />
    </span>
  );
}
function Metric({
  icon,
  label,
  value,
  detail,
  positive = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <strong className={positive ? "text-lime" : ""}>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}
function AgentCard({
  color,
  icon,
  name,
  role,
  description,
  active,
  findings,
}: {
  color: string;
  icon: ReactNode;
  name: string;
  role: string;
  description: string;
  active: boolean;
  findings: string[];
}) {
  return (
    <article className={`agent-card ${color}`}>
      <div className="agent-card-top">
        <span className="agent-icon">{icon}</span>
        <span className="pill">
          {active ? "Проверка готова" : "Готов к проверке"}
        </span>
      </div>
      <h3>{name}</h3>
      <span className="agent-role">{role}</span>
      <p>{description}</p>
      {active ? (
        <ul className="agent-findings">
          {findings.map((item) => (
            <li key={item}>
              <ChevronRight size={13} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="agent-placeholder">
          <span />
          <span />
          <span />
          <small>Запустите проверку, чтобы увидеть выводы</small>
        </div>
      )}
      <div className="agent-card-bottom">
        <span className="status-dot" />
        Локальная логика · без ИИ API
      </div>
    </article>
  );
}

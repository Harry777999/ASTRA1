export type BlockKind =
  | "acquisition"
  | "audience"
  | "product"
  | "revenue"
  | "agent"
  | "finance"
  | "legal";
export type BusinessBlock = {
  id: string;
  kind: BlockKind;
  name: string;
  cost: number;
  x: number;
  z: number;
};
export type Connection = { from: string; to: string };
export type Assumptions = {
  visitors: number;
  conversion: number;
  price: number;
  churn: number;
  initialCustomers: number;
  variableCost: number;
  cash: number;
};
export type Project = {
  version: 1;
  name: string;
  blocks: BusinessBlock[];
  connections: Connection[];
  assumptions: Assumptions;
};
export type Month = {
  month: number;
  customers: number;
  revenue: number;
  costs: number;
  tax: number;
  profit: number;
  balance: number;
};

export const catalog: Record<
  BlockKind,
  {
    title: string;
    description: string;
    color: string;
    cost: number;
    mark: string;
    category: string;
  }
> = {
  acquisition: {
    title: "Привлечение",
    description: "Каналы трафика и маркетинговый бюджет",
    color: "#be9cf6",
    cost: 50000,
    mark: "↗",
    category: "Рост",
  },
  audience: {
    title: "Аудитория",
    description: "Посетители и конверсия в клиентов",
    color: "#88b8ff",
    cost: 0,
    mark: "◎",
    category: "Рост",
  },
  product: {
    title: "SaaS-продукт",
    description: "Ценность продукта и инфраструктура",
    color: "#c6f77c",
    cost: 25000,
    mark: "◇",
    category: "Продукт",
  },
  revenue: {
    title: "Подписка",
    description: "Цена, отток и регулярная выручка",
    color: "#f8c77e",
    cost: 5000,
    mark: "$",
    category: "Финансы",
  },
  agent: {
    title: "ИИ-ассистент",
    description: "Модель расходов на автоматизацию поддержки",
    color: "#8bdbcd",
    cost: 12000,
    mark: "✧",
    category: "Операции",
  },
  finance: {
    title: "Бухгалтерия",
    description: "Бюджет на учёт и финансовый контроль",
    color: "#91aec7",
    cost: 10000,
    mark: "▤",
    category: "Финансы",
  },
  legal: {
    title: "Юридический блок",
    description: "Бюджет на договоры и юридическое сопровождение",
    color: "#e7a8bd",
    cost: 15000,
    mark: "§",
    category: "Операции",
  },
};

export const seedProject: Project = {
  version: 1,
  name: "Мой первый SaaS",
  blocks: [
    {
      id: "traffic",
      kind: "acquisition",
      name: "Привлечение",
      cost: 50000,
      x: -4,
      z: -1,
    },
    {
      id: "audience",
      kind: "audience",
      name: "Аудитория",
      cost: 0,
      x: -2,
      z: -3.6,
    },
    {
      id: "product",
      kind: "product",
      name: "SaaS-продукт",
      cost: 25000,
      x: 0,
      z: 0,
    },
    {
      id: "subscription",
      kind: "revenue",
      name: "Подписка",
      cost: 5000,
      x: 3.7,
      z: -1.6,
    },
    {
      id: "assistant",
      kind: "agent",
      name: "ИИ-ассистент",
      cost: 12000,
      x: -2,
      z: 3.1,
    },
    {
      id: "finance",
      kind: "finance",
      name: "Бухгалтерия",
      cost: 10000,
      x: 3,
      z: 2.8,
    },
  ],
  connections: [
    { from: "traffic", to: "audience" },
    { from: "audience", to: "product" },
    { from: "product", to: "subscription" },
    { from: "assistant", to: "product" },
    { from: "subscription", to: "finance" },
  ],
  assumptions: {
    visitors: 2000,
    conversion: 2,
    price: 2900,
    churn: 5,
    initialCustomers: 20,
    variableCost: 300,
    cash: 1200000,
  },
};

export const limits: Record<keyof Assumptions, [number, number]> = {
  visitors: [0, 1000000],
  conversion: [0, 100],
  price: [0, 1000000],
  churn: [0, 100],
  initialCustomers: [0, 1000000],
  variableCost: [0, 1000000],
  cash: [0, 100000000],
};

export function hasRevenuePath(project: Project): boolean {
  // A complete directed funnel is required. Disconnected decorative blocks do not generate revenue.
  const next = (id: string, kind: BlockKind) =>
    project.connections
      .filter((e) => e.from === id)
      .map((e) => project.blocks.find((b) => b.id === e.to))
      .filter((b): b is BusinessBlock => !!b && b.kind === kind);
  return project.blocks
    .filter((b) => b.kind === "acquisition")
    .some((a) =>
      next(a.id, "audience").some((b) =>
        next(b.id, "product").some((c) => next(c.id, "revenue").length > 0),
      ),
    );
}

export function simulate(project: Project, months = 12): Month[] {
  const a = project.assumptions;
  const active = hasRevenuePath(project);
  const fixedCosts = project.blocks.reduce((sum, b) => sum + b.cost, 0);
  let customers = active ? a.initialCustomers : 0;
  let balance = a.cash;
  return Array.from({ length: months }, (_, i) => {
    customers = active
      ? customers * (1 - a.churn / 100) + (a.visitors * a.conversion) / 100
      : 0;
    const revenue = customers * a.price;
    const costs = fixedCosts + customers * a.variableCost;
    const tax = revenue * 0.06;
    const profit = revenue - costs - tax;
    balance += profit;
    return { month: i + 1, customers, revenue, costs, tax, profit, balance };
  });
}

export function connect(project: Project, from: string, to: string): Project {
  if (
    from === to ||
    !project.blocks.some((b) => b.id === from) ||
    !project.blocks.some((b) => b.id === to)
  )
    return project;
  if (project.connections.some((e) => e.from === from && e.to === to))
    return project;
  return { ...project, connections: [...project.connections, { from, to }] };
}

export function removeBlock(project: Project, id: string): Project {
  return {
    ...project,
    blocks: project.blocks.filter((b) => b.id !== id),
    connections: project.connections.filter(
      (e) => e.from !== id && e.to !== id,
    ),
  };
}

export function parseProject(raw: string): Project {
  if (raw.length > 200000)
    throw new Error("Файл слишком большой. Максимум — 200 КБ.");
  let p: Project;
  try {
    p = JSON.parse(raw);
  } catch {
    throw new Error("Не удалось прочитать JSON-файл.");
  }
  if (
    !p ||
    p.version !== 1 ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 80 ||
    !Array.isArray(p.blocks) ||
    p.blocks.length > 30 ||
    !Array.isArray(p.connections) ||
    p.connections.length > 200 ||
    !p.assumptions ||
    typeof p.assumptions !== "object"
  )
    throw new Error("Неверный формат проекта ASTRA.");
  const ids = new Set<string>();
  for (const b of p.blocks) {
    if (
      !b ||
      typeof b.id !== "string" ||
      !b.id ||
      b.id.length > 80 ||
      ids.has(b.id) ||
      !Object.hasOwn(catalog, b.kind) ||
      typeof b.name !== "string" ||
      !b.name.trim() ||
      b.name.length > 60 ||
      !Number.isFinite(b.cost) ||
      b.cost < 0 ||
      b.cost > 1000000 ||
      !Number.isFinite(b.x) ||
      Math.abs(b.x) > 10 ||
      !Number.isFinite(b.z) ||
      Math.abs(b.z) > 10
    ) {
      throw new Error("В проекте есть некорректный или повторяющийся блок.");
    }
    ids.add(b.id);
  }
  const edges = new Set<string>();
  for (const e of p.connections) {
    if (
      !e ||
      !ids.has(e.from) ||
      !ids.has(e.to) ||
      e.from === e.to ||
      edges.has(JSON.stringify([e.from, e.to]))
    )
      throw new Error("В проекте есть некорректная связь.");
    edges.add(JSON.stringify([e.from, e.to]));
  }
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = p.assumptions[key as keyof Assumptions];
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error("Параметры экономики вне допустимых значений.");
  }
  // Reconstruct known fields only. Imported files cannot add arbitrary application state.
  return {
    version: 1,
    name: p.name.trim(),
    blocks: p.blocks.map((b) => ({
      id: b.id,
      kind: b.kind,
      name: b.name,
      cost: b.cost,
      x: b.x,
      z: b.z,
    })),
    connections: p.connections.map((e) => ({ from: e.from, to: e.to })),
    assumptions: Object.fromEntries(
      Object.keys(limits).map((k) => [
        k,
        p.assumptions[k as keyof Assumptions],
      ]),
    ) as Assumptions,
  };
}

export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
export const number = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
export const STORAGE_KEY = "astra-project-v1";

import { describe, expect, it } from "vitest";
import {
  connect,
  hasRevenuePath,
  parseProject,
  removeBlock,
  seedProject,
  simulate,
} from "./model";

describe("business simulation", () => {
  it("calculates churn, new subscribers, revenue, costs, USN and cash in sequence", () => {
    const p = structuredClone(seedProject);
    p.assumptions = {
      visitors: 1000,
      conversion: 2,
      price: 1000,
      churn: 10,
      initialCustomers: 100,
      variableCost: 100,
      cash: 200000,
    };
    p.blocks = p.blocks.map((b) => ({ ...b, cost: 1000 }));
    const result = simulate(p);
    expect(result).toHaveLength(12);
    // 100 × 90% + 1000 × 2% = 110 customers; fixed costs = 6 × 1000.
    expect(result[0]).toEqual({
      month: 1,
      customers: 110,
      revenue: 110000,
      costs: 17000,
      tax: 6600,
      profit: 86400,
      balance: 286400,
    });
    expect(result[1].customers).toBe(119);
    expect(result[1].balance).toBe(result[0].balance + result[1].profit);
  });
  it("does not invent revenue from disconnected or backwards funnels", () => {
    expect(hasRevenuePath(seedProject)).toBe(true);
    const p = {
      ...seedProject,
      connections: seedProject.connections.map((e) => ({
        from: e.to,
        to: e.from,
      })),
    };
    expect(hasRevenuePath(p)).toBe(false);
    const first = simulate(p)[0];
    expect(first.revenue).toBe(0);
    expect(first.customers).toBe(0);
    expect(first.tax).toBe(0);
    expect(first.profit).toBe(-102000);
  });
  it("charges tax on income even when the business is making a loss", () => {
    const p = structuredClone(seedProject);
    p.assumptions.price = 100;
    const first = simulate(p)[0];
    expect(first.profit).toBeLessThan(0);
    expect(first.tax).toBeCloseTo(first.revenue * 0.06);
  });
  it("handles zero conversion, zero churn and complete churn without NaN", () => {
    const p = structuredClone(seedProject);
    p.assumptions = {
      ...p.assumptions,
      initialCustomers: 0,
      conversion: 0,
      churn: 0,
    };
    expect(simulate(p)[11].customers).toBe(0);
    p.assumptions = {
      ...p.assumptions,
      initialCustomers: 100,
      conversion: 2,
      churn: 100,
    };
    expect(simulate(p).every((m) => m.customers === 40)).toBe(true);
    expect(simulate(p).every((m) => Number.isFinite(m.balance))).toBe(true);
  });
  it("does not multiply shared visitors when a second product is added", () => {
    const p = structuredClone(seedProject);
    p.blocks.push({
      id: "extra",
      kind: "product",
      name: "Second",
      x: 5,
      z: 5,
      cost: 10000,
    });
    const result = simulate(p)[0];
    expect(result.revenue).toBe(simulate(seedProject)[0].revenue);
    expect(result.profit).toBe(simulate(seedProject)[0].profit - 10000);
  });
});

describe("project editing and import boundary", () => {
  it("deletes incident edges and prevents self-loops and duplicate edges", () => {
    const removed = removeBlock(seedProject, "product");
    expect(
      removed.connections.every(
        (e) => e.from !== "product" && e.to !== "product",
      ),
    ).toBe(true);
    expect(hasRevenuePath(removed)).toBe(false);
    expect(connect(seedProject, "product", "product")).toBe(seedProject);
    expect(connect(seedProject, "product", "missing")).toBe(seedProject);
    expect(connect(seedProject, "product", "subscription")).toBe(seedProject);
    expect(connect(seedProject, "finance", "product").connections).toHaveLength(
      seedProject.connections.length + 1,
    );
  });
  it("round-trips projects losslessly", () => {
    expect(parseProject(JSON.stringify(seedProject))).toEqual(seedProject);
  });
  it("rejects invalid references and duplicate identifiers before replacing the project", () => {
    const p = structuredClone(seedProject);
    p.connections.push({ from: "missing", to: "product" });
    expect(() => parseProject(JSON.stringify(p))).toThrow(/связь/);
    p.connections.pop();
    p.blocks.push(p.blocks[0]);
    expect(() => parseProject(JSON.stringify(p))).toThrow(/блок/);
  });
  it("rejects negative economics, unsupported kinds and excessive file size", () => {
    const p = structuredClone(seedProject);
    p.assumptions.price = -1;
    expect(() => parseProject(JSON.stringify(p))).toThrow(/Параметры/);
    expect(() =>
      parseProject(
        JSON.stringify(seedProject).replace('"acquisition"', '"__proto__"'),
      ),
    ).toThrow(/блок/);
    expect(() => parseProject("x".repeat(200001))).toThrow(/большой/);
    expect(() => parseProject("{")).toThrow(/JSON/);
  });
  it("rejects duplicate edges and discards unknown imported fields", () => {
    const p = structuredClone(seedProject);
    p.connections.push(p.connections[0]);
    expect(() => parseProject(JSON.stringify(p))).toThrow(/связь/);
    expect(
      parseProject(
        JSON.stringify({ ...seedProject, token: "should-not-be-imported" }),
      ),
    ).not.toHaveProperty("token");
  });
});

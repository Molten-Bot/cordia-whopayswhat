import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  addExpense,
  addParticipant,
  clearSettledExpenses,
  createDefaultState,
  formatCurrency,
  getExpenseShare,
  parseStoredState,
  removeExpense,
  removeParticipant,
  setExpenseSettled,
} from "../public/app.js";

test("createDefaultState uses supplied id factory for participants and expenses", () => {
  let nextId = 1;
  const state = createDefaultState(() => `id-${nextId++}`);

  assert.equal(state.appName, "WhoPaysWhat");
  assert.deepEqual(
    state.participants.map((participant) => participant.id),
    ["id-1", "id-2", "id-3", "id-4"],
  );
  assert.deepEqual(
    state.expenses.map((expense) => expense.id),
    ["id-5", "id-6", "id-7"],
  );
  assert.deepEqual(state.expenses[0].participantIds, ["id-1", "id-2", "id-3", "id-4"]);
  assert.deepEqual(state.expenses[2].participantIds, ["id-3", "id-4"]);
});

test("parseStoredState merges valid stored values with defaults", () => {
  const defaultState = createDefaultState(() => "default-id");
  const stored = JSON.stringify({
    appName: "Typed WhoPaysWhat",
    theme: "dark",
    participants: [{ id: "person-1", name: "Sam" }],
    expenses: [
      {
        id: "expense-1",
        description: "Coffee",
        amount: 12,
        payerId: "person-1",
        participantIds: ["person-1"],
        settled: true,
      },
    ],
  });

  assert.deepEqual(parseStoredState(stored, defaultState), {
    appName: "Typed WhoPaysWhat",
    theme: "dark",
    participants: [{ id: "person-1", name: "Sam" }],
    expenses: [
      {
        id: "expense-1",
        description: "Coffee",
        amount: 12,
        payerId: "person-1",
        participantIds: ["person-1"],
        settled: true,
      },
    ],
  });
});

test("parseStoredState repairs expense split ids that no longer exist", () => {
  const defaultState = createDefaultState(() => "default-id");
  const stored = JSON.stringify({
    participants: [
      { id: "person-1", name: "Sam" },
      { id: "person-2", name: "Priya" },
    ],
    expenses: [
      {
        id: "expense-1",
        description: "Dinner",
        amount: 80,
        payerId: "missing",
        participantIds: ["person-1", "missing"],
        settled: false,
      },
    ],
  });

  const state = parseStoredState(stored, defaultState);

  assert.equal(state.expenses[0].payerId, "person-1");
  assert.deepEqual(state.expenses[0].participantIds, ["person-1"]);
});

test("parseStoredState falls back when stored JSON is invalid", () => {
  const defaultState = createDefaultState(() => "default-id");

  assert.equal(parseStoredState("{", defaultState), defaultState);
});

test("expense reducers add, settle, remove, and clear expenses immutably", () => {
  const state = {
    appName: "WhoPaysWhat",
    theme: "system",
    participants: [
      { id: "sam", name: "Sam" },
      { id: "maya", name: "Maya" },
    ],
    expenses: [
      {
        id: "one",
        description: "One",
        amount: 20,
        payerId: "sam",
        participantIds: ["sam", "maya"],
        settled: false,
      },
      {
        id: "two",
        description: "Two",
        amount: 10,
        payerId: "maya",
        participantIds: ["maya"],
        settled: true,
      },
    ],
  };

  const added = addExpense(
    state,
    { description: " Three ", amount: 30, payerId: "sam", participantIds: ["sam", "sam", "maya"] },
    () => "three",
  );
  const settled = setExpenseSettled(added, "one", true);
  const removed = removeExpense(settled, "two");
  const cleared = clearSettledExpenses(removed);

  assert.deepEqual(added.expenses[0], {
    id: "three",
    description: "Three",
    amount: 30,
    payerId: "sam",
    participantIds: ["sam", "maya"],
    settled: false,
  });
  assert.equal(state.expenses[0].settled, false);
  assert.deepEqual(cleared.expenses, [
    {
      id: "three",
      description: "Three",
      amount: 30,
      payerId: "sam",
      participantIds: ["sam", "maya"],
      settled: false,
    },
  ]);
});

test("addExpense rejects missing split participants and invalid payer", () => {
  const state = createDefaultState(() => "id");

  assert.equal(
    addExpense(state, {
      description: "Dinner",
      amount: 40,
      payerId: "missing",
      participantIds: [state.participants[0].id],
    }),
    state,
  );
  assert.equal(
    addExpense(state, {
      description: "Dinner",
      amount: 40,
      payerId: state.participants[0].id,
      participantIds: ["missing"],
    }),
    state,
  );
});

test("participant reducers add unique people and repair expenses on removal", () => {
  const state = {
    appName: "WhoPaysWhat",
    theme: "system",
    participants: [
      { id: "sam", name: "Sam" },
      { id: "maya", name: "Maya" },
    ],
    expenses: [
      {
        id: "one",
        description: "One",
        amount: 20,
        payerId: "maya",
        participantIds: ["maya"],
        settled: false,
      },
    ],
  };

  const added = addParticipant(state, " Alex ", () => "alex");
  const duplicate = addParticipant(added, "alex", () => "duplicate");
  const removed = removeParticipant(duplicate, "maya");

  assert.deepEqual(
    added.participants.map((participant) => participant.name),
    ["Sam", "Maya", "Alex"],
  );
  assert.equal(duplicate, added);
  assert.equal(removed.expenses[0].payerId, "sam");
  assert.deepEqual(removed.expenses[0].participantIds, ["sam", "alex"]);
});

test("currency and share helpers format expense amounts", () => {
  assert.equal(formatCurrency(12), "$12.00");
  assert.equal(
    getExpenseShare({
      id: "one",
      description: "Dinner",
      amount: 90,
      payerId: "sam",
      participantIds: ["sam", "maya", "alex"],
      settled: false,
    }),
    30,
  );
});

test("served files do not reference disallowed providers or tooling", async () => {
  const servedFiles = [
    "public/app.js",
    "public/humans.txt",
    "public/index.html",
    "public/llm.txt",
  ];

  for (const file of servedFiles) {
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /\bgit\b|cloudflare/i, file);
  }
});

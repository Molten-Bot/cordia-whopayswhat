// Google Analytics default capture for this template.
// Future LLM edits: do not remove this gtag setup unless replacing it with equivalent page analytics capture.
const googleAnalyticsId = "G-ZKTPLMMFDQ";
const storageKey = "whopayswhat-state";

type Theme = "system" | "light" | "dark";

export interface Participant {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  payerId: string;
  participantIds: string[];
  settled: boolean;
}

export interface AppState {
  appName: string;
  theme: Theme;
  participants: Participant[];
  expenses: Expense[];
}

export interface ExpenseInput {
  description: string;
  amount: number;
  payerId: string;
  participantIds: string[];
}

interface AppElements {
  appNameInput: HTMLInputElement;
  clearExpensesButton: HTMLButtonElement;
  expenseAmountInput: HTMLInputElement;
  expenseCount: HTMLElement;
  expenseDescriptionInput: HTMLInputElement;
  expenseForm: HTMLFormElement;
  expenseList: HTMLUListElement;
  navLinks: NodeListOf<HTMLAnchorElement>;
  participantForm: HTMLFormElement;
  participantList: HTMLUListElement;
  participantNameInput: HTMLInputElement;
  participantOptions: HTMLElement;
  participantSummary: HTMLElement;
  payerSelect: HTMLSelectElement;
  saveState: HTMLElement;
  splitAllInput: HTMLInputElement;
  themeSelect: HTMLSelectElement;
  title: HTMLHeadingElement;
}

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

function createParticipant(name: string, idFactory: () => string): Participant {
  return { id: idFactory(), name };
}

function createExpense(
  description: string,
  amount: number,
  payerId: string,
  participantIds: string[],
  settled: boolean,
  idFactory: () => string,
): Expense {
  return { id: idFactory(), description, amount, payerId, participantIds, settled };
}

export function createDefaultState(idFactory: () => string = () => crypto.randomUUID()): AppState {
  const participants = ["Sam", "Priya", "Jordan", "Maya"].map((name) =>
    createParticipant(name, idFactory),
  );
  const [sam, priya, jordan, maya] = participants;

  if (!sam || !priya || !jordan || !maya) {
    throw new Error("Default participants failed to initialize");
  }

  const allParticipantIds = participants.map((participant) => participant.id);

  return {
    appName: "WhoPaysWhat",
    theme: "system",
    participants,
    expenses: [
      createExpense("Rent", 1800, sam.id, allParticipantIds, false, idFactory),
      createExpense("Groceries", 126, priya.id, allParticipantIds, false, idFactory),
      createExpense("Movie tickets", 64, jordan.id, [jordan.id, maya.id], true, idFactory),
    ],
  };
}

function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isParticipant(value: unknown): value is Participant {
  if (!value || typeof value !== "object") return false;
  const participant = value as Record<string, unknown>;
  return typeof participant.id === "string" && typeof participant.name === "string";
}

function isExpense(value: unknown): value is Expense {
  if (!value || typeof value !== "object") return false;
  const expense = value as Record<string, unknown>;
  return (
    typeof expense.id === "string" &&
    typeof expense.description === "string" &&
    typeof expense.amount === "number" &&
    Number.isFinite(expense.amount) &&
    expense.amount > 0 &&
    typeof expense.payerId === "string" &&
    isStringArray(expense.participantIds) &&
    expense.participantIds.length > 0 &&
    typeof expense.settled === "boolean"
  );
}

function normalizeParticipantIds(ids: string[], participants: Participant[]): string[] {
  const validIds = new Set(participants.map((participant) => participant.id));
  return [...new Set(ids)].filter((id) => validIds.has(id));
}

function sanitizeExpenses(expenses: Expense[], participants: Participant[], fallback: Expense[]): Expense[] {
  if (participants.length === 0) return fallback;
  const participantIds = participants.map((participant) => participant.id);
  const validIds = new Set(participantIds);

  return expenses.flatMap((expense) => {
    const payerId = validIds.has(expense.payerId) ? expense.payerId : participantIds[0];
    if (!payerId) return [];

    const splitIds = normalizeParticipantIds(expense.participantIds, participants);

    return [
      {
        ...expense,
        payerId,
        participantIds: splitIds.length > 0 ? splitIds : participantIds,
      },
    ];
  });
}

export function parseStoredState(storedState: string | null, defaultState: AppState): AppState {
  if (!storedState) return defaultState;

  try {
    const parsed = JSON.parse(storedState) as Record<string, unknown>;
    const participants =
      Array.isArray(parsed.participants) && parsed.participants.every(isParticipant)
        ? parsed.participants
        : defaultState.participants;
    const expenses =
      Array.isArray(parsed.expenses) && parsed.expenses.every(isExpense)
        ? sanitizeExpenses(parsed.expenses, participants, defaultState.expenses)
        : defaultState.expenses;

    return {
      appName: typeof parsed.appName === "string" ? parsed.appName : defaultState.appName,
      theme: isTheme(parsed.theme) ? parsed.theme : defaultState.theme,
      participants,
      expenses,
    };
  } catch {
    return defaultState;
  }
}

export function getParticipantName(state: AppState, id: string): string {
  return state.participants.find((participant) => participant.id === id)?.name ?? "Unknown";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function getExpenseShare(expense: Expense): number {
  return expense.amount / expense.participantIds.length;
}

export function addParticipant(
  state: AppState,
  name: string,
  idFactory: () => string = () => crypto.randomUUID(),
): AppState {
  const trimmedName = name.trim();
  if (!trimmedName) return state;
  const alreadyExists = state.participants.some(
    (participant) => participant.name.toLowerCase() === trimmedName.toLowerCase(),
  );
  if (alreadyExists) return state;

  return {
    ...state,
    participants: [...state.participants, createParticipant(trimmedName, idFactory)],
  };
}

export function removeParticipant(state: AppState, id: string): AppState {
  if (state.participants.length <= 1) return state;

  const participants = state.participants.filter((participant) => participant.id !== id);
  if (participants.length === state.participants.length) return state;

  const participantIds = participants.map((participant) => participant.id);
  const fallbackPayerId = participantIds[0];
  if (!fallbackPayerId) return state;

  return {
    ...state,
    participants,
    expenses: state.expenses.map((expense) => {
      const splitIds = expense.participantIds.filter((participantId) => participantId !== id);

      return {
        ...expense,
        payerId: expense.payerId === id ? fallbackPayerId : expense.payerId,
        participantIds: splitIds.length > 0 ? splitIds : participantIds,
      };
    }),
  };
}

export function addExpense(
  state: AppState,
  input: ExpenseInput,
  idFactory: () => string = () => crypto.randomUUID(),
): AppState {
  const description = input.description.trim();
  const payerExists = state.participants.some((participant) => participant.id === input.payerId);
  const participantIds = normalizeParticipantIds(input.participantIds, state.participants);

  if (!description || !Number.isFinite(input.amount) || input.amount <= 0 || !payerExists) {
    return state;
  }
  if (participantIds.length === 0) return state;

  return {
    ...state,
    expenses: [
      createExpense(description, input.amount, input.payerId, participantIds, false, idFactory),
      ...state.expenses,
    ],
  };
}

export function setExpenseSettled(state: AppState, id: string, settled: boolean): AppState {
  return {
    ...state,
    expenses: state.expenses.map((expense) =>
      expense.id === id ? { ...expense, settled } : expense,
    ),
  };
}

export function removeExpense(state: AppState, id: string): AppState {
  return {
    ...state,
    expenses: state.expenses.filter((expense) => expense.id !== id),
  };
}

export function clearSettledExpenses(state: AppState): AppState {
  return { ...state, expenses: state.expenses.filter((expense) => !expense.settled) };
}

function initializeGoogleAnalytics() {
  const googleTagScript = document.createElement("script");
  googleTagScript.async = true;
  googleTagScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
  document.head.append(googleTagScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", googleAnalyticsId);
}

function getElement<T extends Element>(selector: string, type: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function getElements(): AppElements {
  return {
    appNameInput: getElement("#app-name", HTMLInputElement),
    clearExpensesButton: getElement("#clear-expenses", HTMLButtonElement),
    expenseAmountInput: getElement("#expense-amount", HTMLInputElement),
    expenseCount: getElement("#expense-count", HTMLElement),
    expenseDescriptionInput: getElement("#expense-description", HTMLInputElement),
    expenseForm: getElement("#expense-form", HTMLFormElement),
    expenseList: getElement("#expense-list", HTMLUListElement),
    navLinks: document.querySelectorAll<HTMLAnchorElement>(".nav a"),
    participantForm: getElement("#participant-form", HTMLFormElement),
    participantList: getElement("#participant-list", HTMLUListElement),
    participantNameInput: getElement("#participant-name", HTMLInputElement),
    participantOptions: getElement("#participant-options", HTMLElement),
    participantSummary: getElement("#participant-summary", HTMLElement),
    payerSelect: getElement("#payer-select", HTMLSelectElement),
    saveState: getElement("#save-state", HTMLElement),
    splitAllInput: getElement("#split-all", HTMLInputElement),
    themeSelect: getElement("#theme-select", HTMLSelectElement),
    title: getElement(".topbar h1", HTMLHeadingElement),
  };
}

function initializeApp() {
  initializeGoogleAnalytics();

  const defaultState = createDefaultState();
  const elements = getElements();
  let state = parseStoredState(localStorage.getItem(storageKey), defaultState);
  let saveTimer: number | undefined;

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    elements.saveState.textContent = "Saved locally";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      elements.saveState.textContent = "Changes autosave";
    }, 1600);
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
  }

  function getSelectedParticipantIds(): string[] {
    const selectedInputs =
      elements.participantOptions.querySelectorAll<HTMLInputElement>('input[name="split-with"]:checked');
    return Array.from(selectedInputs, (input) => input.value);
  }

  function renderPayerOptions() {
    const selectedPayerId = elements.payerSelect.value || state.participants[0]?.id;
    elements.payerSelect.replaceChildren();

    state.participants.forEach((participant) => {
      const option = document.createElement("option");
      option.value = participant.id;
      option.textContent = participant.name;
      elements.payerSelect.append(option);
    });

    if (selectedPayerId && state.participants.some((participant) => participant.id === selectedPayerId)) {
      elements.payerSelect.value = selectedPayerId;
    }
  }

  function updateSplitAllState() {
    const selectedCount = getSelectedParticipantIds().length;
    elements.splitAllInput.checked = selectedCount === state.participants.length;
    elements.splitAllInput.indeterminate =
      selectedCount > 0 && selectedCount < state.participants.length;
  }

  function renderParticipantOptions() {
    const selectedIds = new Set(getSelectedParticipantIds());
    const selectedParticipants =
      selectedIds.size > 0
        ? state.participants.filter((participant) => selectedIds.has(participant.id))
        : state.participants;
    elements.participantOptions.replaceChildren();

    state.participants.forEach((participant) => {
      const label = document.createElement("label");
      label.className = "choice";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "split-with";
      input.value = participant.id;
      input.checked = selectedParticipants.some((selected) => selected.id === participant.id);
      input.addEventListener("change", updateSplitAllState);

      const span = document.createElement("span");
      span.textContent = participant.name;

      label.append(input, span);
      elements.participantOptions.append(label);
    });

    updateSplitAllState();
  }

  function renderParticipants() {
    elements.participantList.replaceChildren();

    state.participants.forEach((participant) => {
      const row = document.createElement("li");
      row.className = "participant-row";

      const name = document.createElement("span");
      name.textContent = participant.name;

      const removeButton = document.createElement("button");
      removeButton.className = "icon-button";
      removeButton.type = "button";
      removeButton.ariaLabel = `Remove ${participant.name}`;
      removeButton.textContent = "x";
      removeButton.disabled = state.participants.length <= 1;
      removeButton.addEventListener("click", () => {
        state = removeParticipant(state, participant.id);
        saveState();
        render();
      });

      row.append(name, removeButton);
      elements.participantList.append(row);
    });
  }

  function getSplitLabel(expense: Expense): string {
    if (expense.participantIds.length === state.participants.length) return "All";

    return expense.participantIds.map((id) => getParticipantName(state, id)).join(", ");
  }

  function renderExpenses() {
    elements.expenseList.replaceChildren();

    if (state.expenses.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "empty-state";
      emptyState.textContent = "No bills yet. Add one and choose who shares it.";
      elements.expenseList.append(emptyState);
      return;
    }

    state.expenses.forEach((expense) => {
      const row = document.createElement("li");
      row.className = "expense-row";
      row.dataset.settled = String(expense.settled);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = expense.settled;
      checkbox.ariaLabel = `Mark ${expense.description} settled`;
      checkbox.addEventListener("change", () => {
        state = setExpenseSettled(state, expense.id, checkbox.checked);
        saveState();
        render();
      });

      const details = document.createElement("div");
      details.className = "expense-details";

      const title = document.createElement("strong");
      title.textContent = `${expense.description} ${formatCurrency(expense.amount)}`;

      const meta = document.createElement("span");
      meta.textContent = `${getParticipantName(state, expense.payerId)} paid. Split: ${getSplitLabel(
        expense,
      )}. Share: ${formatCurrency(getExpenseShare(expense))}`;

      details.append(title, meta);

      const removeButton = document.createElement("button");
      removeButton.className = "icon-button";
      removeButton.type = "button";
      removeButton.ariaLabel = `Remove ${expense.description}`;
      removeButton.textContent = "x";
      removeButton.addEventListener("click", () => {
        state = removeExpense(state, expense.id);
        saveState();
        render();
      });

      row.append(checkbox, details, removeButton);
      elements.expenseList.append(row);
    });
  }

  function renderSummary() {
    elements.expenseCount.textContent = String(state.expenses.length);
    elements.participantSummary.textContent = `${state.participants.length} people`;
  }

  function render() {
    document.title = state.appName;
    elements.title.textContent = state.appName;
    elements.appNameInput.value = state.appName;
    elements.themeSelect.value = state.theme;
    applyTheme();
    renderSummary();
    renderPayerOptions();
    renderParticipantOptions();
    renderParticipants();
    renderExpenses();
  }

  function updateCurrentNavLink() {
    const currentHash = window.location.hash || "#overview";
    elements.navLinks.forEach((link) => {
      link.setAttribute("aria-current", link.getAttribute("href") === currentHash ? "page" : "false");
    });
  }

  elements.expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const selectedParticipantIds = getSelectedParticipantIds();
    state = addExpense(state, {
      description: elements.expenseDescriptionInput.value,
      amount: Number(elements.expenseAmountInput.value),
      payerId: elements.payerSelect.value,
      participantIds:
        selectedParticipantIds.length > 0
          ? selectedParticipantIds
          : state.participants.map((participant) => participant.id),
    });
    saveState();
    render();
    elements.expenseForm.reset();
    renderPayerOptions();
    renderParticipantOptions();
    elements.expenseDescriptionInput.focus();
  });

  elements.clearExpensesButton.addEventListener("click", () => {
    state = clearSettledExpenses(state);
    saveState();
    render();
  });

  elements.splitAllInput.addEventListener("change", () => {
    const splitInputs =
      elements.participantOptions.querySelectorAll<HTMLInputElement>('input[name="split-with"]');
    splitInputs.forEach((input) => {
      input.checked = elements.splitAllInput.checked;
    });
    updateSplitAllState();
  });

  elements.participantForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state = addParticipant(state, elements.participantNameInput.value);
    saveState();
    render();
    elements.participantNameInput.value = "";
    elements.participantNameInput.focus();
  });

  elements.appNameInput.addEventListener("input", () => {
    state = { ...state, appName: elements.appNameInput.value.trim() || "WhoPaysWhat" };
    saveState();
    render();
  });

  elements.themeSelect.addEventListener("change", () => {
    state = { ...state, theme: elements.themeSelect.value as Theme };
    saveState();
    render();
  });

  window.addEventListener("hashchange", updateCurrentNavLink);

  render();
  updateCurrentNavLink();
}

if (typeof document !== "undefined") {
  initializeApp();
}

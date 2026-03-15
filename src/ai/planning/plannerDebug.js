const DEBUG_ENDPOINT = '/api/planner-debug';
const MAX_BROWSER_RUNS = 10;

function snapshot(value) {
  if (value === undefined) return null;

  try {
    return JSON.parse(JSON.stringify(value, (_key, entry) => {
      if (entry instanceof Error) {
        return {
          name: entry.name,
          message: entry.message,
          stack: entry.stack,
        };
      }
      return entry;
    }));
  } catch (error) {
    return {
      snapshotError: error.message,
      valueType: typeof value,
    };
  }
}

function getBrowserStore() {
  if (typeof window === 'undefined') return null;
  const browserWindow = window;
  if (!Array.isArray(browserWindow.__plannerDebugRuns)) {
    browserWindow.__plannerDebugRuns = [];
  }
  return browserWindow;
}

function persistToBrowser(run) {
  const browserWindow = getBrowserStore();
  if (!browserWindow) return;

  browserWindow.__plannerDebugRuns = [
    ...browserWindow.__plannerDebugRuns.slice(-(MAX_BROWSER_RUNS - 1)),
    run,
  ];
  browserWindow.__lastPlannerDebugRun = run;
}

function logToConsole(run) {
  if (typeof console === 'undefined') return;

  const label = `[planner-debug:${run.requestId}] ${run.mode} ${run.status}`;
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(label);
    console.log(run);
    console.groupEnd();
    return;
  }

  console.log(label, run);
}

async function persistToServer(run) {
  if (typeof fetch !== 'function') return null;

  const response = await fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(run),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Planner debug log failed: ${response.status} ${errorText}`);
  }

  return response.json().catch(() => null);
}

export function createPlannerDebugRun({
  mode,
  ideaText,
  userMessage,
  systemPrompt,
  constraints,
  provider,
  xp,
  currentPlan = null,
}) {
  return {
    requestId: `planner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    status: 'running',
    startedAt: new Date().toISOString(),
    xp,
    input: snapshot({
      ideaText,
      userMessage,
      systemPrompt,
      currentPlan,
      constraints,
      provider: {
        className: provider?.constructor?.name ?? 'UnknownProvider',
        model: provider?.model ?? null,
        maxTokens: provider?.maxTokens ?? null,
        apiUrl: provider?.apiUrl ?? null,
      },
    }),
    attempts: [],
    notes: [],
    result: null,
    persistence: null,
  };
}

export function addPlannerDebugAttempt(run, label, payload) {
  if (!run) return;
  run.attempts.push({
    label,
    at: new Date().toISOString(),
    payload: snapshot(payload),
  });
}

export function addPlannerDebugNote(run, label, payload = null) {
  if (!run) return;
  run.notes.push({
    label,
    at: new Date().toISOString(),
    payload: snapshot(payload),
  });
}

export async function finalizePlannerDebugRun(run, {
  status,
  result,
  error = null,
} = {}) {
  if (!run) return null;

  run.status = status ?? run.status ?? 'completed';
  run.finishedAt = new Date().toISOString();
  run.result = snapshot(result);
  run.error = snapshot(error);

  persistToBrowser(run);
  logToConsole(run);

  try {
    const persistence = await persistToServer(run);
    run.persistence = snapshot(persistence);
    persistToBrowser(run);
    return persistence;
  } catch (persistError) {
    run.persistence = {
      error: persistError.message,
    };
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[planner-debug] Failed to persist debug log:', persistError);
    }
    persistToBrowser(run);
    return null;
  }
}

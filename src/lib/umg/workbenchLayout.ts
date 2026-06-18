export type WorkbenchLayoutState = {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
};

const key = 'umg-studio.workbench-layout.v1';

export const defaultWorkbenchLayout: WorkbenchLayoutState = {
  leftWidth: 340,
  rightWidth: 400,
  bottomHeight: 280,
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: false
};

type LayoutStorage = Pick<Storage, 'getItem' | 'setItem'>;

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

export function normalizeWorkbenchLayout(value: Partial<WorkbenchLayoutState> | undefined): WorkbenchLayoutState {
  return {
    leftWidth: clamp(value?.leftWidth, 220, 560, defaultWorkbenchLayout.leftWidth),
    rightWidth: clamp(value?.rightWidth, 260, 620, defaultWorkbenchLayout.rightWidth),
    bottomHeight: clamp(value?.bottomHeight, 150, 520, defaultWorkbenchLayout.bottomHeight),
    leftCollapsed: Boolean(value?.leftCollapsed),
    rightCollapsed: Boolean(value?.rightCollapsed),
    bottomCollapsed: Boolean(value?.bottomCollapsed)
  };
}

export function loadWorkbenchLayout(storage: LayoutStorage | undefined): WorkbenchLayoutState {
  if (!storage) return defaultWorkbenchLayout;
  try {
    const raw = storage.getItem(key);
    return raw ? normalizeWorkbenchLayout(JSON.parse(raw)) : defaultWorkbenchLayout;
  } catch {
    return defaultWorkbenchLayout;
  }
}

export function saveWorkbenchLayout(storage: LayoutStorage | undefined, layout: WorkbenchLayoutState) {
  if (!storage) return;
  storage.setItem(key, JSON.stringify(normalizeWorkbenchLayout(layout)));
}

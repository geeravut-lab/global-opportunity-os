// Browser-only activity state; no URL, request body, user identity or response content is retained.
const subscribers = new Set<() => void>();
const tokens = new Set<symbol>();
const scopes = new Map<
  HTMLElement,
  {
    count: number;
    busy: string | null;
    disabled: Map<HTMLElement, string | null>;
  }
>();
const emit = () => {
  for (const subscriber of subscribers) subscriber();
};
export const subscribeActivity = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};
export const activityCount = () => tokens.size;
export const serverActivityCount = () => 0;
export function beginActivity(element?: HTMLElement | null) {
  if (typeof window === "undefined") return () => {};
  const active =
    element ??
    (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);
  const scope =
    active?.closest<HTMLElement>("form") ??
    active?.closest<HTMLElement>("button,a") ??
    null;
  const token = Symbol();
  tokens.add(token);
  if (scope) {
    let record = scopes.get(scope);
    if (!record) {
      record = {
        count: 0,
        busy: scope.getAttribute("aria-busy"),
        disabled: new Map(),
      };
      scopes.set(scope, record);
      scope.dataset.goosBusy = "true";
      scope.setAttribute("aria-busy", "true");
      const controls = scope.matches("form")
        ? scope.querySelectorAll<HTMLElement>(
            "button:not([type=button]):not([type=reset]),input[type=submit]",
          )
        : [scope];
      for (const control of controls) {
        record.disabled.set(control, control.getAttribute("aria-disabled"));
        control.setAttribute("aria-disabled", "true");
      }
    }
    record.count++;
  }
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    tokens.delete(token);
    if (scope) {
      const record = scopes.get(scope);
      if (record && --record.count === 0) {
        delete scope.dataset.goosBusy;
        if (record.busy === null) scope.removeAttribute("aria-busy");
        else scope.setAttribute("aria-busy", record.busy);
        for (const [control, value] of record.disabled) {
          if (value === null) control.removeAttribute("aria-disabled");
          else control.setAttribute("aria-disabled", value);
        }
        scopes.delete(scope);
      }
    }
    emit();
  };
}
export function blockDuplicateAction(event: Event) {
  const target = event.target instanceof Element ? event.target : null;
  if (
    event instanceof MouseEvent &&
    (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
  )
    return;
  const scope = target?.closest<HTMLElement>("[data-goos-busy=true]");
  if (
    scope &&
    (event.type === "submit" || target?.closest("button,a,input[type=submit]"))
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
export async function busyFetch(input: RequestInfo | URL, init?: RequestInit) {
  const finish = beginActivity();
  try {
    const response = await fetch(input, init);
    await response.clone().arrayBuffer();
    return response;
  } finally {
    finish();
  }
}
export function navigateWithActivity(url: string) {
  const finish = beginActivity();
  window.addEventListener("pagehide", finish, { once: true });
  window.addEventListener("pageshow", finish, { once: true });
  try {
    window.location.assign(url);
  } catch (error) {
    finish();
    throw error;
  }
}

export function trackNativeNavigation(
  event: Event,
  navigate?: (url: string) => void,
) {
  if (
    event.defaultPrevented ||
    !(event.target instanceof HTMLFormElement) ||
    event.target.target === "_blank"
  )
    return;
  const form = event.target;
  if (new URL(form.action, location.href).origin !== location.origin) return;
  if (form.method.toLowerCase() === "get" && navigate) {
    event.preventDefault();
    const url = new URL(form.action, location.href);
    const submitter = event instanceof SubmitEvent ? event.submitter : null;
    const data = new FormData(form, submitter);
    url.search = new URLSearchParams(
      [...data].map(([key, value]) => [
        key,
        typeof value === "string" ? value : value.name,
      ]),
    ).toString();
    navigate(url.pathname + url.search + url.hash);
    return;
  }
  const finish = beginActivity(form);
  window.addEventListener("pagehide", finish, { once: true });
  window.addEventListener("pageshow", finish, { once: true });
}

export function nextLiveDelay(quiet: number, connected: boolean) {
  return connected
    ? 60000
    : Math.min(60000, 4000 * (quiet >= 18 ? 4 : quiet >= 6 ? 2 : 1));
}
export function mayRefresh(visible: boolean, dirty: boolean, pathname: string) {
  return visible && !dirty && !/\/auth\/|\/account\/security$/.test(pathname);
}
export function ownLiveTopics(id: string) {
  return [`goos:u:${id}`, "goos:settings"];
}
export function liveDeadlineDelay(
  delay: number,
  next: string | null | undefined,
  now = Date.now(),
) {
  const deadline = next ? Date.parse(next) : NaN;
  return Number.isFinite(deadline)
    ? Math.max(250, Math.min(delay, deadline - now + 100))
    : delay;
}

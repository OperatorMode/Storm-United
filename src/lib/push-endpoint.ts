// This phone's push address (browser side), so the server can skip just the
// sending phone when it notifies the team. Null if notifications are off.
export async function pushEndpoint(): Promise<string | null> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
  } catch {
    return null;
  }
}

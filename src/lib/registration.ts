const FORM_ID = (import.meta as any).env.VITE_REGISTRATION_FORM_ID as string | undefined;
const EVENT_ENTRY = (import.meta as any).env.VITE_REGISTRATION_EVENT_ENTRY as string | undefined;

/** Prefilled Google Form URL with the event ID baked into the Event Code field. */
export function buildRegistrationLink(eventId: string): string | null {
  if (!FORM_ID || !EVENT_ENTRY) return null;
  return `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`
    + `?usp=pp_url&${EVENT_ENTRY}=${encodeURIComponent(eventId)}`;
}

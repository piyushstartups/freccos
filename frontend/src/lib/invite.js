// Shared invite share logic. Used by MyProfile, People tab, post-signup screen,
// and anywhere a user shares their invite link.
import { track, Events } from "./analytics";
import { toast } from "sonner";

export const inviteUrl = (code) => `https://freccos.com/invite/${code}`;

export const buildInviteMessage = (code) =>
  `You know how you always wish you could just ask your friends for travel recommendations instead of googling random reviews?

That is what Freccos is. It is where your friends' honest recommendations actually live. I have been adding all my travel recs on here.

You have been to so many amazing places. Would love your recommendations on here so the rest of us can experience them too.

Join here: ${inviteUrl(code)}`;

export async function shareInvite({ code, surface }) {
  if (!code) return { ok: false };
  const text = buildInviteMessage(code);
  track(Events.INVITE_CODE_SHARED, { surface });
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return { ok: true, shared: true };
    } catch {
      return { ok: true, shared: false }; // user cancelled — still treat as a "completed" invite moment
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Invite copied");
    return { ok: true, shared: true };
  } catch {
    toast("Copy failed");
    return { ok: false };
  }
}

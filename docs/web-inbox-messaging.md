# WorkSet web notifications & private messaging

## Where it lives

- The **bell beside Me** shows the unread count and a **compact preview** of recent notifications.
- Select a notification or **View all in Me** to go to **Me → Inbox & Messages**.
- The **full inbox, Accept/Decline actions, message threads, browser-alert preference and email invitation preference** live inside the Me page, not in a pop-up over Today.
- Messages includes direct chats with accepted friends, ad-hoc group chats of 2–20 friends, and program-group conversations.
- **Together → Community → Message group** opens the matching thread inside Me.
- The layout is web-first. No APK-specific user interface is being designed in this phase.

Notifications and messages are protected by per-user/member RLS. Private group sharing remains opt-in. Adding someone to **My Team** without a WorkSet account does not invite or notify them.

## Enable WorkSet email using aalbertsberg.us

WorkSet's `workset-invite-email` Supabase Edge Function is already deployed. It sends through **Resend**. Supabase Auth's SMTP settings are not automatically used for these invitations.

1. Open your existing Resend account → Domains. If `aalbertsberg.us` is not yet verified there, add it and publish the exact DKIM/SPF (and any other) DNS records Resend gives you. Preserve existing MX and unrelated DNS records.
2. In **the WorkoutBoard Supabase project** (`lplybuzlgowxeszkvtqe`) → Edge Functions → Secrets, set:
   - `RESEND_API_KEY` = your Resend sending API key (server-side only).
   - `WORKSET_EMAIL_FROM` = `WorkSet <notifications@aalbertsberg.us>`
   - `WORKSET_APP_URL` = `https://aalbertsberg-dotcom.github.io/WorkoutBoard/`
3. Confirm the verified sender is authorized in Resend. Use a fresh friend or group invite to test end-to-end delivery.

**Never paste API keys into the browser, WorkSet client code or GitHub.** These are server-side secrets. WorkSet continues to send in-app invitations even if the email provider is not configured; it reports that separately. Recipients can turn off invitation emails in Me → Inbox & Messages.

## Web acceptance test

1. Sign into two browsers with different WorkSet accounts. On A, add B as a friend. Verify B's bell unread badge and the small dropdown; choose **View all in Me**. Confirm it opens the inline Me inbox and Accept/Decline works.
2. On a phone-sized viewport, open the bell from Today and confirm **no large overlay**, horizontal clipping or covered workout cards. Open Me and confirm the full inbox scrolls inside its section.
3. On A, go to Me → Inbox & Messages → Messages and send B a direct message. Verify it arrives, and can only be seen by participants. Repeat for a group conversation.
4. Create a Together program group, invite B and accept it in Me. Press **Message group**; verify it opens Me on the correct group thread.
5. Invite B to a Live workout; accept in Me and verify the correct session opens.
6. Enable browser notifications and test while WorkSet remains open in a background tab. This is not browser push when closed.
7. With Resend verified and the Supabase secrets configured, verify delivery of a real invitation to an opted-in recipient, and verify an opted-out recipient receives only the in-app invitation.

The web build and browser smoke suite must pass before any end-to-end success claim. Two-account and real email-delivery checks remain separate from automated browser checks.

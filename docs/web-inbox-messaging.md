# WorkSet web notifications & private messaging

## What is installed

- Header bell with unread count, Accept/Decline for friend, Live workout and program-group invitations.
- Browser alerts are optional (permission button). These only operate while a WorkSet tab is open; they are not background push.
- Direct messages between accepted friends; ad-hoc group conversations of 2–20 friends; private program-group conversations.
- Notifications, messages, group invitations and membership are protected by per-user/member RLS. Only stored workout summaries are shared with groups.
- Email invitation delivery is through a server-side Supabase Edge Function; the browser never receives the provider API key.
- The "My Team" list permits non-account athletes. Adding one of those people is not a WorkSet account invitation and does not notify anyone.

## Enable actual outgoing email (required configuration)

The Edge Function `workset-invite-email` is deployed. To send email, configure the following **server-side Supabase Edge Function secrets** under Project → Edge Functions → Secrets:

1. `RESEND_API_KEY`: your Resend API key.
2. `WORKSET_EMAIL_FROM`: a verified sender such as `WorkSet <notifications@YOUR-VERIFIED-DOMAIN>`.
3. `WORKSET_APP_URL`: the real HTTPS URL of your WorkSet web app (GitHub Pages path if applicable).

Verify the sender domain in Resend before enabling this feature. Do not commit or paste API keys into frontend code or the repository.

If the sender is not configured, invitations still appear inside WorkSet. The UI explicitly says email is unavailable. Recipients may disable invitation emails in the bell settings; the email function enforces this preference. Attempts require a logged-in sender, a matching invitation and a recent invite; repeat invitation emails are throttled.

## Focused two-account web test

1. Open WorkSet in two separately signed-in browsers. On A, add B as a friend. Within 12 seconds B should see a badge on the bell. Accept there; both accounts should show the friendship.
2. From A's bell → Messages → New, message B. Verify B sees the new message in the inbox, and cannot read another conversation.
3. With two accepted friends selected, create a group conversation and exchange messages. Confirm both recipients see the message and unread indicator.
4. In Together → Community create a program group; invite B from its friend dropdown. B accepts in the notification bell. Press **Message group** and send a message.
5. Invite B to a Live session; B accepts in the bell and the correct session opens.
6. Disable email invitations on B, then send another eligible invitation and verify no email is delivered. Enable browser alerts and repeat while WorkSet is open in an inactive tab.
7. If mail secrets are configured, verify one invitation email per fresh request and an automatic link back to WorkSet. No mail-provider setup means the expected result is **in-app only**.

Do not claim complete end-to-end success without two live accounts and verified mail-provider delivery.

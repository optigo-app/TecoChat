# TecoChat — Data Flow Reference

Maintenance guide: every flow is listed step-by-step with **file → function → purpose**.
When you need to manually update a behavior, find the flow below, then edit the
file/function named in that step. Line numbers are approximate (they drift as code
changes) — search for the function name.

Companion doc: `SOCKET_EVENTS.md` (full payload shapes for every socket event).

---

## 0. Architecture in one picture

```
Browser ──► app/layout.tsx (providers + no-flash scripts)
      ──► proxy.ts (optimistic redirect for remember-me users)
      ──► AuthGuard (client session gate)
      ──► app/page.tsx ──► CustomerLists (left pane) + ChatPanel (right pane)

Data planes:
  REST   : every API = axios POST {con:{mode}, p, f} → {base}/report
           (CommonApi.ts) — headers from Config.ts getApiHeaders()
  Socket : socket.ts singleton, Set-based handler fan-out,
           emits auto-append `receiveEvent`
  IDB    : Dexie db `tecochat_{authId}` — 8 stores (see §3)
  Bus    : window CustomEvents for cross-component updates
           (UPDATE_CONVERSATION_ITEM, SERVICE_UP/DOWN, SELECT_CONVERSATION, …)
```

**Golden rule of this codebase:** sending is **REST-first, socket-second**.
REST persists and returns the real `MessageId`; the socket emit afterwards is
only a realtime nudge to receivers. Two emits (`msg_send`, `delete_message`)
also loop back locally so the sender's UI updates without a server round-trip.

---

## 1. Storage map — where every piece of state lives

### sessionStorage

| Key | Written by | Read by | Purpose |
|---|---|---|---|
| `userData` | LoginPageV2 (~L231), AutoLogin (~L112), LoginData effect (~L173) | layout `authRedirectScript`, LoginData init, AuthGuard, `getApiHeaders`, SocketContext fallback | Logged-in user `{userId, username, ukey, token, id, ufcc, …}` |
| `token` | LoginPageV2, AutoLogin | LoginData init, `getApiHeaders` | `{sv, yc}` → `sv`/`Yearcode` API headers |
| `isLoggedIn` | LoginPageV2, AutoLogin, LoginData | SocketContext | `"true"` flag |
| `socketState` | `socket.ts` `initializeSocket` | `socket.ts` restore/reconnect; removed by `disconnectSocket(true)` | `{token}` — lets socket reconnect at module load / page refresh |
| `clientIpAddress` | `globalFunc.getClientIpAddress` | same | Cached public IP injected into `con` of every API body |

### localStorage

| Key | Purpose |
|---|---|
| `remembered_companycode` / `remembered_userId` | Login page remember-me prefill |
| `PWA_DeviceId` | Persistent device UUID sent in login payloads (`getDeviceDetails`) |
| `app_version_current` | Current deployed app version (versionManager) |
| `tecochat-color-mode` | light/dark theme (ThemeRegistry) |
| `tecochat-sound-settings` | `{enabled, volume, notification, send, delivered, read}` (sound.ts) |
| `internal_sidebar_collapsed` | Sidebar collapse state |

### Cookies (`cookieUtils.ts`, 15-day expiry, `SameSite=Lax`)

| Cookie | Purpose |
|---|---|
| `userData`, `token` | Remember-me session restore — read by `proxy.ts`, layout script, LoginData fallback |
| `remembered_creds` | JSON `{companycode, userId}` for login prefill |

### IndexedDB — Dexie, per-user DB `tecochat_{authId}`

Schema: `src/db/tecoDb.ts`. Opened/persisted by `DbProvider` (`src/db/dbContext.tsx`).
Wiped by `deleteDb(authId)` on logout / sessionLogout / Data Sync resync.

| Store | Helper file | Holds | Cap/TTL |
|---|---|---|---|
| `messages` | `messageCache.ts` | Cached message rows per conversation (alias-id dedupe, temp→server canonicalization) | 2000 msgs/conv trim; LRU evict >85% quota |
| `conversations` | `conversationCache.ts` | Conversation list rows incl. serialized `lastMessage` preview | `putConversations` = **full-table replace** each fetch |
| `groupMembers` | `groupMembersCache.ts` | Member list per group (typing/reaction/read fan-out, @mentions) | ~5 min TTL |
| `drafts` | `draftCache.ts` | Unsent input per conversation; cross-tab via Dexie `liveQuery` | — |
| `syncState` | `syncStateCache.ts` + `outboxCache.ts` | Per-conv cursors `{oldestCursor, newestCursor, hasOlder, hasNewer, lastSequence}` | — |
| `outbox` | `outboxCache.ts` | Pending/failed outgoing messages (media stored as raw `Blob` in `meta.files[]`) | `sending` rows >60 s auto-recovered |
| `searchCache` | `searchCache.ts` | Message-search results keyed `${convId}:${query}` | 5 min TTL, non-empty only |

### Window CustomEvent bus (cross-component updates)

| Event | Fired by | Consumed by |
|---|---|---|
| `SELECT_CONVERSATION` / `SELECT_NEW_CONVERSATION` | list clicks, notification click, `sw.js` click relay | `app/page.tsx` → `setSelectedCustomer` |
| `UPDATE_CONVERSATION_ITEM` | socket handlers, group APIs, mute/fav/pin, delete, forward | `useConversationList`, `app/page.tsx` (merges into `selectedCustomer`), `FavoriteContext` |
| `UPDATE_CONVERSATION_MUTE` | mute API callers | list + details panel |
| `DELETE_CONVERSATION(_ITEM)` | exit/delete group flows | `app/page.tsx`, list |
| `CLEAR_CONVERSATION_MESSAGES` | clear-chat flows | `useConversation` reducer, details search box |
| `SERVICE_UP` / `SERVICE_DOWN` | SocketContext (connect / 10 s grace on disconnect), `useConversationList` (fetch success / `stat_msg` failure) | `app/page.tsx` (MaintenancePage gate), `useServiceRetry` |
| `CHAT_DRAFTS_UPDATED` | `draftCache` liveQuery | conversation list draft previews |
| `OUTBOX_MESSAGE_SENT / RETRYING / FAILED`, `OUTBOX_RETRY_REQUESTED` | `useOutboxSync`, retry button | `useConversation` → `MSG.UPSERT`/`DELETE_ME` |
| `MEDIA_REPLACE_OR_ADD` | `useMediaHandlers` | `ChatPanel` → `ReplaceAddMediaDialog` |
| `FILES_DROPPED_ON_CONVERSATION` | `dropFileQueue` (sidebar drop) | `useConversation` → `processFiles` |
| `MENTION_CLICK`, `SHOW_ALL_MENTIONS`, `SHOW_MEMBER_INFO`, `OPEN_PROFILE_PANEL`, `TECOCHAT_QUERY_OVERLAY`, `TECOCHAT_POP_OVERLAY`, `UPDATE_FAVICON_BADGE` | various | ChatPanel/CustomerLists/page |

### React contexts (provider order in `app/layout.tsx`)

`LoginData → DbProvider → SocketProvider → Favorite → RemoveInGroup →
GroupAdminMode → GroupSocket → Notification`

| Context | File | Exposes |
|---|---|---|
| `LoginData` | `src/contexts/LoginData.tsx` | `auth`, `token`, `setAuth`, `setToken` |
| `SocketContext` | `src/contexts/SocketContext.tsx` | `{status, isConnected, socketId}` |
| `GroupSocketContext` | `src/contexts/GroupSocketContext.tsx` | per-conversationId listener registration (`registerListener`) |
| `RemoveInGroupContext` | `src/contexts/RemoveInGroupContext.tsx` | `isRemoved` flags → composer lock + "Delete group" UI |
| `GroupAdminModeContext` | `src/contexts/GroupAdminModeContext.tsx` | `groupSettingsState` → `isGroupOnlyAdminSend` composer gate |
| `NotificationContext` | `src/contexts/NotificationContext.tsx` | permission status, `requestPermission`, SW registration |
| `Favorite` | `src/contexts/FavoriteContext.tsx` | favorite-conversation state |

---

## 2. Flow: App boot & auth gate

| # | File → function | What happens |
|---|---|---|
| 1 | `proxy.ts` → `proxy` | Server-side: `/login` + `userData`/`token` cookie → redirect `/`. (Optimistic only — sessionStorage is invisible to server.) |
| 2 | `app/layout.tsx` → `themeNoFlashScript` | `beforeInteractive`: sets `data-theme` from `localStorage["tecochat-color-mode"]` |
| 3 | `app/layout.tsx` → `authRedirectScript` | `beforeInteractive`: `hasAuth()` = `sessionStorage.userData` else `userData` cookie, needs `userId && (token||ukey)`. `/` without auth → `/login`; `/login` with auth → `/` |
| 4 | `PreHydrationLoader` | Raw HTML splash; removed ~700 ms post-hydration |
| 5 | Provider tree mounts (order in §1) | `DbProvider` opens `tecochat_{id}` + `storage.persist()`; `SocketContext` effect keyed on `auth.token` |
| 6 | `src/socket.ts` module top-level → `restoreConnection()` | Runs at import: `socketState` → `initializeSocket(token)` — socket may connect before React effects |
| 7 | `app/page.tsx` → `AuthGuard` | `auth.userId && (auth.token||auth.ukey)` else `disconnectSocket(true)` + `/login` |
| 8 | `app/page.tsx` → `HomeContent` | `getConversations(auth)` IDB check → `hasCachedData` (gates MaintenancePage); mounts `useServiceRetry`, `useVersionCheck`, `useFaviconBadge`; renders `AppLayout` → `CustomerLists` + `ChatPanel` (both `next/dynamic`) |

## 3. Flow: Login (manual / auto / multi-session)

### 3a. Manual login — `src/components/LoginPage/LoginPageV2.tsx`

| # | Function | Purpose |
|---|---|---|
| 1 | mount effect (~L55) | `remembered_*` localStorage or `remembered_creds` cookie → pre-call `getToken` |
| 2 | `handleCompanyCodeBlur` / `handleCompanySubmit` | `getToken(companycode)` (`src/API/GetToken/GetToken.ts`, mode `VerifyCompany`) → `rd[0].stat===1` → `sessionStorage.token = {sv,yc}` → `step:"signin"` |
| 3 | `handleSignInSubmit` (~L176) | Re-verifies token if missing → `fetchLoginApi` (`src/API/LoginAPI/LoginAPI.ts`, mode `login`, SHA1 password via `passwordToSha1`, `getDeviceDetails()` merged in) |
| 4 | same | `initializeSocket(userInfo.token)` — socket connects **before** `setAuth` |
| 5 | same | Writes `sessionStorage.userData`, `isLoggedIn`; remember-me → localStorage `remembered_*` + cookies `userData`/`token`/`remembered_creds` (15 d); else erases cookies |
| 6 | `setAuth(userData)` → LoginData effect rewrites `userData` | `router.replace("/")` |

### 3b. Auto-login — `app/auto-login/page.tsx`

`?data=`/`?auto-login=` → `atob`+JSON → `fetchAutoLoginApi` (mode `RedirectToErp`,
extra headers `Yearcode`/`sv`/`pageName`) → writes session keys + `setToken` →
`initializeSocket` → on `connect` emits `internal.store_sockets` → `setAuth` → `/`.
Session-only (no cookies). ⚠ `internal.store_sockets` may fire twice — once here,
once in `SocketContext.onConnect`.

### 3c. `/session-check` — REMOVED

The legacy "already logged in elsewhere" page (`LoginExists`) was deleted: its
gate key `sessionStorage.hasSocketId` was never written by any code path, so
the route was unreachable. Server-driven duplicate-session handling still works
via the socket `sessionLogout` event → `SocketContext.handleSessionLogout`.

## 4. Flow: Socket lifecycle & reconnect

| # | File → function | Purpose |
|---|---|---|
| 1 | `src/socket.ts` → `initializeSocket(token)` | Persists `socketState`; `io(getSocketURL(), {auth:{token}, reconnection:true})`; wires all `internal:*` listeners to dispatch Sets |
| 2 | `SocketContext` effect (dep `auth.token`) | Calls `initializeSocket`; `onConnect` → `status="connected"`, `SERVICE_UP`, `emitInternalStoreSocketData({userId, ufcc})` |
| 3 | `SocketContext` `onDisconnect`/`onConnectError` | status `connecting`/`error`; schedules `SERVICE_DOWN` after **10 s grace** for transport-close/server-disconnect/502/xhr-poll-error |
| 4 | `socket.io.on("reconnect")` | Cancels grace timer + `SERVICE_UP` |
| 5 | 5 s interval + `online`/`focus`/`visibilitychange` | `isSocketConnected()` → `reconnectSocket()`; note `isSocketConnected()` itself can `initializeSocket` from `socketState` (≤5 attempts) |
| 6 | `sessionLogout` event → `SocketContext.handleSessionLogout` | `deleteDb` + `sessionStorage.clear` + erase 3 cookies + `disconnectSocket(true)` → `/login` |
| 7 | `disconnectSocket(permanent)` | Clears ALL handler Sets; `permanent` removes `socketState` |

**Dispatch model** (`socket.ts` `dispatch`): every `internal:*` event is pushed to
a `Set<Handler>`; each `addXHandler(h)` returns an unsubscribe. Multiple
subscribers per event = intentional fan-out (see §7).

## 5. Flow: Initial sync & conversation list

| # | File → function | Purpose |
|---|---|---|
| 1 | `src/hooks/useConversationList.ts` mount effect (~L809) | `getConversations(auth)` — IDB first; hit → paint instantly; miss → `preloading` → `<SyncingScreen>` |
| 2 | `loadMembers(1)` → `fetchConversationLists` (`src/API/ConverLists/ConversationLists.ts`, mode `GetConversationList`, PageSize 100) | Server list → normalize/sort → `putConversations` **full IDB replace** → `SERVICE_UP` |
| 3 | (cache-empty only) `preLoadConversations` (mode `PreLoadConversation`, `MessageCount:100`) | Embedded recent messages per conv → `putMessages` → first open is instant → `setPreloading(false)` |
| 4 | `getAllDrafts()` | Hydrates `Draft`/`DraftTime` preview fields |
| 5 | Scroll bottom → `loadMembers(page+1)` until `rd.length < pageSize`; search input → debounced Page-1 reload | Pagination + search loop |
| 6 | `updateConversationApi` (mode `UpdateConversation`) + `updateConversationCache` | Pin/favorite/archive per-row update (NOT full replace) |

## 6. Flow: Open conversation & message loading

| # | File → function | Purpose |
|---|---|---|
| 1 | list click / `SELECT_CONVERSATION` | `app/page.tsx` → `setSelectedCustomer` → `useConversation` conversation-change effect (~L489): flush previous draft, reset reducers, abort in-flight requests |
| 2 | `useMessageLoader.loadConversation` (`CoreLogic/useMessageLoader.ts` ~L438) | `consumeOpenAtLatest` (30 s TTL flag from notification taps) decides anchor: latest vs first-unread |
| 3 | `getConversationFromCache` | **IDB renders first**, network merges after |
| 4 | `conversationViewCursor` (mode `GetMessagesCursor`, `ConversationView.ts`) | `Direction:0` initial; guards = AbortController + request-id + conv-id check — **replicate all three in any new fetch path** |
| 5 | `messagesReducer MSG.LOAD/APPEND` + `putMessages` + `setSyncState` | Merge (dedupes alias ids, folds optimistic twins via `isOptimisticPair`), persist, record cursors |
| 6 | Prefetch + **background history backfill loop** (~L760) | Repeats `Direction:2` until target/`hasMoreBefore` false/abort |
| 7 | `MessageList` top sentinel → `loadOlderMessages` (`Direction:2`, `getMessagesBefore` first) | Older pagination; cursor-unchanged guard prevents infinite loop; error → `retryLoadOlder` button |
| 8 | Bottom sentinel → `loadNewerMessages` (`Direction:1`) | Newer pagination |
| 9 | `jumpToLatest` | `Direction:0` reload; empty anchored result → one `Cursor:0` retry |
| 10 | Scrolled-up incoming msgs → `MSG.BUFFER_NEW` → `pendingNewMessages`; `FLUSH_NEW` on scroll-to-bottom | Keeps scroll position stable |

## 7. Flow: Incoming message (the big fan-out)

```
server → socket.on("internal:msg_receive")                      socket.ts:138
  → dispatch(internalMessageHandlers)
    ├─ A. useSocketHandlers.handleInternalMessage               useSocketHandlers.ts:207
    │    • drops own msgs (SenderId/name filter 211-227)
    │    • conv open + at-bottom → addUniqueMessage → MSG.UPSERT
    │      + upsertMessage → IDB messages + emitReadReceipt
    │    • conv open + scrolled up → MSG.BUFFER_NEW
    │    • conv not open → no-op (list side handles it)
    └─ B. useConversationList.handleSocketUpdate                 useConversationList.ts:322
         • update/insert row: lastMessage preview, unreadCount++,
           re-sort to top, upsertConversation → IDB conversations
         • gates → notifyQueue → notify("NEW_MESSAGE")
             (skipped if outgoing / conv open+focused / muted&&!mentioned)
```

**Same two subscribers also receive the local echo** when YOU send
(`emitInternalMessageSend` dispatches locally at `socket.ts:262`): A drops it
(self-filter), B uses it to update the preview. That is why a sent message
appears in the list without a server round-trip.

### Fan-out summary for every receive event

| Event | Subscriber 1 | Subscriber 2 | Subscriber 3 |
|---|---|---|---|
| `msg_receive` | ChatPanel `useSocketHandlers` → MSG.UPSERT + IDB `messages` | list `useConversationList` → row + IDB `conversations` + notify | — |
| `msg_read` | `handleChangeStatus` → MSG.UPDATE_STATUS + IDB + sounds + `UPDATE_CONVERSATION_ITEM` | list status merge | `UPDATE_CONVERSATION_ITEM` → `app/page.tsx`, `FavoriteContext` |
| `typing` | `useTypingIndicator` (open chat bubble) | list typing indicator (5 s expiry) | — |
| `delete_message` | chat `MSG.DELETE_ALL` + IDB | list preview rewrite | — |
| `reaction_*` (4 events) | chat `MSG.UPDATE_REACTION` + IDB | list status merge | — |
| `group_*` | `GroupSocketContext` → per-conv listener (system msg + toasts) | list merge/push | — |
| `member_*` | per-conv listener (toasts, `RemoveInGroup`, admin flags) | list merge or `loadMembers` refetch | — |
| `group_permission` | per-conv listener (synthetic system msg) | list notify | `GroupAdminModeContext` (composer gate) |
| `app_version_update` | `useVersionCheck` | — | — |
| `sessionLogout` | `SocketContext.handleSessionLogout` | — | — |

## 8. Flow: Send text message

`ChatInput.handleSend` → `ChatPanel.handleSendWithScroll` →
`useMessageActions.handleSendMessage` (`CoreLogic/useMessageActions.ts:70`):

| # | Step | Detail |
|---|---|---|
| 1 | Optimistic `MSG.UPSERT` | `tempId = Date.now()-rand`, `Status:"pending"`, `Direction:1`, `ClientMessageId`, mentions JSON, reply context |
| 2 | `addToOutbox` → IDB `outbox` | **Always for text** — key `conv:tempId`, status `pending` |
| 3 | Offline? → stop (stays queued) | `isOffline` from `useOnlineStatus` |
| 4 | REST: `sendTextMessage` (mode `SendMessage`) or `replyToMessageApi` (mode `ReplyToMessage`) | Persists; returns `rd.MessageId`, `rd.ConversationId` |
| 5 | Fail → `Status:4` + `updateOutboxStatus("failed")` | Retry via `retryFailedMessage` or `useOutboxSync` |
| 6 | Groups: `fetchAndCacheGroupMembers` → memberIds | Receiver fan-out list |
| 7 | `emitTextMessage` → `emitInternalMessageSend` | `internal:msg_send` + local dispatch (updates list preview) |
| 8 | Reconcile `MSG.UPSERT` temp→server id, `Status:1` | `removeFromOutbox` + `deleteMessageRow` temp ghost |
| 9 | `rd.IsNewConversation` → `onCustomerSelect` with real `ConversationId` | How AddConversation chats get their real id |
| 10 | `playSound("send")` after API confirm | — |

## 9. Flow: Send media

| # | File → function | Purpose |
|---|---|---|
| 1 | Acquire: `AttachmentMenu`, drag-drop (`MessageList` ~L675 → `DragDropOverlay`), paste (ChatInput/LexicalChatEditor `PasteHandlerPlugin`), sidebar drop (`dropFileQueue` → `FILES_DROPPED_ON_CONVERSATION`), camera input | All converge on `processFiles` |
| 2 | `useMediaHandlers.processFiles` (L109) | `validateMediaFiles` (≤30 files, ≤100 MB each/total) → `buildMediaFileItems` (blob previews, lazy dims) → `UI.SET_MEDIA_FILES`; already-staged → `MEDIA_REPLACE_OR_ADD` → `ReplaceAddMediaDialog` |
| 3 | `MediaPreview` editor | Captions, image editing (draw/blur/crop), `exportAllEditedImages` → `onSend` → `handleSendMessage` |
| 4 | `handleSendMessage` media branch | Optimistic msg(s) `Status:"pending", isUploading`; **multi-doc batch → one optimistic per file** |
| 5 | `uploadAndSendMedia` (L239): offline → `addToOutbox` with raw `Blob`s | Media enters outbox **only when offline** ⚠ online upload failure can't auto-retry (blob revoked) |
| 6 | `uploadFiles` → `compressImagesToWebP` → `POST {base}/upload` | WebP compression (1 MB/1920px/q0.8); progress → `MSG.UPSERT {percent}` |
| 7 | `sendImageMessage`/`sendVideoMessage`/`sendDocumentMessage` (modes `SendMediaMessage`, MessageType 2/3/4) | REST persist per file |
| 8 | `emitMediaMessage(buildMediaPayload)` → `internal:msg_send` | Multi-doc: CSV MessageIds → N emits + N UPSERTs |
| 9 | New conversation → `onCustomerSelect` + `UPDATE_CONVERSATION_ITEM` | — |

## 10. Flow: Outbox & reconnect sync (data re-flows here)

| # | File → function | Purpose |
|---|---|---|
| 1 | `useOutboxSync` triggers: socket→`connected`, `OUTBOX_RETRY_REQUESTED`, `online`, `retryVersion` | Drains `getPendingOutbox` (pending + failed + `sending`>60 s) |
| 2 | Per entry: `updateOutboxStatus("sending")` → **re-runs entire send pipeline** (re-upload blobs → REST → `emitTextMessage`/`emitMediaMessage`) → `OUTBOX_MESSAGE_SENT` + `removeFromOutbox`; fail → `"failed"` + event | `attempts++` each cycle, **no max cap** |
| 3 | `useConversation` listeners (~L302) | `OUTBOX_*` events → `MSG.UPSERT`/`DELETE_ME` on temp rows |
| 4 | `useReconnectSync` on socket reconnect | `getSyncState` → `GetMessagesCursor` Direction AFTER (50) → `MSG.APPEND` + cache + cursors — inbound gap-fill; may re-deliver own queued msg (deduped by `isOptimisticPair`) |
| 5 | `retryFailedMessage` (`useMessageActions` L482) | Requeues `pending` + `OUTBOX_RETRY_REQUESTED`; media without outbox row → toast "media is no longer available" |

## 11. Flow: Read receipts (two-stage emit)

`useReadReceipt.handleReadMessage` (`CoreLogic/useReadReceipt.ts:47`) — debounced
1 s, skipped when tab hidden/drawer open/same conv <3 s. Called on open, focus,
incoming-at-bottom, `FLUSH_NEW`.

1. `emitReadReceipt(..., status=2)` — **one `internal:msg_read` emit per
   recipient id** for groups (`socketHelpers.emitReadReceipt` loops).
2. `readMessageApi` (mode `ReadMessage`) → `rd[0].MsgRead===1` → second
   `emitReadReceipt(..., status=3)` to unique senders.
3. Receive side: `handleChangeStatus` → `MSG.UPDATE_STATUS` (**monotonic, never
   regresses**), `updateMessageStatus` → IDB, `UPDATE_CONVERSATION_ITEM`, sounds
   `delivered`/`read` for outgoing only.

## 12. Flow: Typing

- Emit: `useTypingEmitter` — 1 emit/s throttle, auto-stop after 1 s idle, stop on
  conv switch/unmount; groups resolve member ids via `fetchAndCacheGroupMembers`.
- Receive: `internal:typing` → `useTypingIndicator` (open chat) + list indicator;
  self `SenderId` filtered; 5 s auto-clear.

## 13. Flow: Reactions / edit / delete / forward / star

| Action | API mode | Socket emit | Local/IDB | Notes |
|---|---|---|---|---|
| Reaction add/toggle | `AddReaction` (toggle-off = `Emoji:""`) | `internal:reaction_send` | `MSG.UPSERT ReactionEmojis`; receive → `MSG.UPDATE_REACTION` + `updateMessageReaction` | 700 ms dedupe in `useReactions` |
| Reaction remove | `RemoveReaction` | `internal:reaction_remove` | same | — |
| Edit msg | `UpdateMessage` (`editMessageApi`) | `internal:msg_send` (`isEdited:1`) | `MSG.EDIT` + `updateMessageEdit` | EditMessageDialog reuses Lexical editor |
| Delete for everyone | `DeleteMessage` mode 2 | `internal:delete_message` (+local dispatch) | `MSG.DELETE_ALL` + `deleteMessage` + `UPDATE_CONVERSATION_ITEM` — **list updated twice by design** | `canDeleteForAll` gate |
| Delete for me | `DeleteMessage` mode 1 | — | `MSG.DELETE_ME` + `deleteMessageRow` + list rollback | — |
| Forward | `ForwardMessage` (`forwardMessageApi`) | `internal:msg_send` per target | `MSG.UPSERT` if target open | `forwardlistApi` mode `GetForwardList`; `UPDATE_CONVERSATION_ITEM` per target |
| Star | `MakeStartMessage` (`starMessageApi`) | — | `MSG.STAR` + `updateMessageStar` | Per-user, no socket |
| Clear chat | `ClearChat` | — | `clearConversation` + `deleteDraft` | + `CLEAR_CONVERSATION_MESSAGES`, `UPDATE_CONVERSATION_ITEM` |

## 14. Flow: Group management

| Action | API mode / file | Socket emit | Post-success |
|---|---|---|---|
| Create group | `CreateGroupApi` → `CreateGroup` | `emitGroupCreated` | `UPDATE_CONVERSATION_ITEM` + `SELECT_NEW_CONVERSATION`; receivers get system msg + list row |
| Edit name/desc/photo | `EditGroupApi` → `EditGroup` | `emitGroupUpdated` (memberIds via `getGroupMemberIds` → `GroupDetails`) | `UPDATE_CONVERSATION_ITEM`; receivers: system msg + merge |
| Add members | `AddGroupParticipantApi` → `AddMembers` | `emitMemberAdded` | `loadGroupInfo`; new member gets `RemoveInGroup` cleared + toast |
| Remove member / exit | `RemoveMemberApi` → `RemoveMembers` | `emitMemberRemoved` (`reason:"removed"|"left"`) | Header-exit path wipes conv+members+draft+row; DangerZone-exit marks `RemoveInGroup:1` read-only |
| Promote/demote | `AssignRoleApi` → `AssignRole`; bulk `MultiAssignRoleApi` | `emitMemberPromoted`/`Demoted` (bulk: **no emit**) | `loadGroupInfo`; ⚠ `CustomerDetails` doesn't pass `currentIsAdmin` → emit defaults to promotion |
| Permission change | `ChangeGroupPermissionApi` → `ChangeGroupPermission` | `emitPermissionChanged` | `GroupAdminModeContext` merge + synthetic system msg; `sendMessages=0` locks composer |
| Delete group | `DeleteConversationApi` → `ConversationDelete` | — (no client emit; `internal:group_deleted` is listen-only) | `DELETE_CONVERSATION_ITEM` |

Receive side: `GroupSocketContext` routes `data.conversationId` → per-conv
listener registered by ChatPanel (`useGroupSocketListeners`); the list also
subscribes for row updates; `groupMembers` IDB cache is separate from
`CustomerDetails.localGroupData` (which uses `fetchGroupDetails` directly).

## 15. Flow: Notifications, sounds, favicon

1. `useConversationList.handleSocketUpdate` → notification gates → `notify()`
   (`utils/notificationTemplates.ts`): `NEW_MESSAGE` coalesces bursts (3 s →
   "N new messages"); ⚠ group templates intentionally absent → group `notify()`
   calls are no-ops (group events surface as toasts only).
2. `showBrowserNotification` (`utils/notifications.ts`): window unfocused +
   granted → SW `registration.showNotification` (else `new Notification`);
   focused → sound only (unless already viewing the conv → silent); denied →
   `showToast` fallback.
3. Click → `sw.js notificationclick` → postMessage `SELECT_CONVERSATION` →
   `app/page.tsx` opens conv; `markOpenAtLatest` → lands at latest.
4. Sounds: `utils/sound.ts` oscillator tones, per-type throttle, settings in
   `localStorage["tecochat-sound-settings"]` (ProfilePanel → `useSoundSettings`);
   audio unlocked on first gesture in `NotificationContext`.
5. Favicon: `useFaviconBadge` draws unread count while tab hidden.

## 16. Flow: Search, drafts, media panel

- **List search:** `CustomerListsHeader` → debounced `GetConversationList` Page 1.
- **Message search:** `useConversation.searchMessages` → `searchCache` (5 min) →
  `GetMessagesCursor` `Direction:3`; `searchByDate` = `Direction:4` + `MsgDate`
  (`JumpToDatePicker`). Result tap → `scrollToMessage` polls DOM ≤2.5 s.
- **Drafts:** saved on conv switch/`beforeunload`/unmount (not per keystroke);
  `liveQuery` → `CHAT_DRAFTS_UPDATED` cross-tab.
- **Details media:** `CustomerDetails.fetchMediaData` → `fetchMediaLists` (mode
  `GetMediaList`), pageSize 6, ref-deduped; no IDB. Group info → `fetchGroupDetails`
  (`GroupDetails`); 1:1 → `contactInfoApi` (`ContactInfo`).
- **New chat:** `AddConversation` → `fetchCustomerLists` (`GetEmployeeList`) →
  temp conversation (`ConversationId:null`) → real id assigned on first send.

## 17. Flow: Version check, service-down, resync, logout

- **Version:** `useVersionCheck` — baseline + 10 min poll of `/version.json`,
  visibility recheck (>30 s), socket `app_version_update`, BroadcastChannel
  `app_version_sync` cross-tab → `UpdateNotification` → `applyUpdate` =
  `hardReloadWithCacheBust` (clear CacheStorage + update SWs + `?_cb` reload).
- **Service down:** `SERVICE_DOWN` from SocketContext (10 s grace) OR
  `fetchConversationLists` `stat_msg` failure → `useServiceRetry` phases
  silent(3×2 s) → auto-1(3×60 s) → auto-5(3×300 s) → stopped; `doCheck` always
  returns false — recovery is driven only by real `SERVICE_UP`. `MaintenancePage`
  shows only when `serviceDown && !hasCachedData`.
- **Data Sync (manual resync):** ProfileAvatar/ProfilePanel → `resyncApp(auth.id)`
  = `deleteDb` + `hardReloadWithCacheBust`; session survives → full re-sync.
- **Logout:** `disconnectSocket(true)` → `deleteDb` → `sessionStorage.clear()` →
  erase `userData`/`token`/`remembered_creds` → reset contexts → `/login`.

---

## 18. "Data flows multiple times" — loop & repeat index

| What repeats | Where | Why |
|---|---|---|
| `getToken` up to 3× per login | LoginPageV2 mount / blur / submit re-verify | Prefill + verify + missing-token guard |
| `userData` written 2× per login | explicit `setItem` then `setAuth`→effect | Context persistence |
| `getConversations` read 3× at boot | `page.tsx` cache check + `useConversationList` mount + `SERVICE_DOWN` recheck | Offline-capability gating |
| `putConversations` full-table replace | every `loadMembers` page | Whole-list resync — **socket upserts to rows outside the fetched page get dropped** (watch this if unread counts regress) |
| `internal.store_sockets` emitted 2× on auto-login | auto-login page + `SocketContext.onConnect` | Duplicate registration |
| Own message processed 2× | `MSG.UPSERT` optimistic + local socket dispatch | Loopback by design (self-filtered in chat, used by list) |
| Delete-for-everyone updates list 2× | local `delete_message` dispatch + explicit `UPDATE_CONVERSATION_ITEM` | Two paths converge on same row |
| Outbox re-runs full pipeline | every `connected`/`online`/`OUTBOX_RETRY_REQUESTED` | Retries: upload→REST→emit→IDB again, no attempt cap |
| Reconnect re-delivers own msgs | `useReconnectSync` AFTER-cursor fetch | Deduped via `isOptimisticPair`/alias ids |
| Read receipts emitted 2× | status 2 always, status 3 after `ReadMessage` API confirm | Two-stage seen→read |
| Socket reconnect via 4 paths | `isSocketConnected` side-effect + 5 s interval + online/focus/visibility + socket.io `reconnection` | Belt-and-suspenders recovery |
| `SERVICE_DOWN` from 2 sources | SocketContext grace timer + list-fetch maintenance flag | Converge on `useServiceRetry` |
| Version checked 5 ways | poll / visibility / socket / broadcast / `controllerchange` | Multi-channel update detection |
| Message dedupe enforced 3 ways | `ClientMessageId` match, `isOptimisticPair` fuzzy match, IDB alias-key deletion | Change one → mirror in the others (`conversationReducer` ↔ `messageCache`) |
| Multi-doc send = N flows | one upload → N emits + N UPSERTs | Batch split |

## 19. Quick lookup — "to change X, edit Y"

| To change… | Edit |
|---|---|
| API base URL / socket URL / headers | `src/API/InitialApi/Config.ts` |
| Add a REST call | `src/API/InitialApi/CommonApi.ts` (`buildCommonBody` + `CommonAPI`, add `mode` string) |
| Add a socket event | `src/socket.ts` (handler Set + `add*Handler` + emit wrapper) + subscriber |
| Send payload shape | `CoreLogic/socketHelpers.ts` (`emitTextMessage`) / `uploadHelpers.ts` (`buildMediaPayload`) |
| Incoming msg → chat | `CoreLogic/useSocketHandlers.ts` |
| Incoming msg → list row/badge/notify | `src/hooks/useConversationList.ts` `handleSocketUpdate` |
| Optimistic bubble fields | `CoreLogic/useMessageActions.ts` `handleSendMessage` |
| Message merge/dedupe rules | `CoreLogic/conversationReducer.ts` + `src/db/messageCache.ts` (mirror changes!) |
| Pagination / anchors | `CoreLogic/useMessageLoader.ts`, `src/API/ConversationView/ConversationView.ts` (Direction enum) |
| Offline queue | `src/db/outboxCache.ts`, `CoreLogic/useOutboxSync.ts` |
| Reconnect gap-fill | `CoreLogic/useReconnectSync.ts` |
| Typing throttle/timing | `CoreLogic/useTypingEmitter.ts`, `useTypingIndicator.ts` |
| Read-receipt timing/status | `CoreLogic/useReadReceipt.ts`, `socketHelpers.emitReadReceipt` |
| Login fields/device info | `src/API/LoginAPI/LoginAPI.ts`, `src/utils/getDeviceDetails.ts` |
| Remember-me expiry | `LoginPageV2.tsx` cookie writes, `src/utils/cookieUtils.ts` |
| Logout wipe | `ProfileAvatar.tsx` `handleLogoutConfirm`, `SocketContext.handleSessionLogout` |
| Resync | `src/utils/resyncApp.ts` |
| Notification text/templates | `src/utils/notificationTemplates.ts` |
| Notification delivery rules | `src/utils/notifications.ts` `showBrowserNotification` |
| Sounds | `src/utils/sound.ts`, `src/hooks/useSoundSettings.ts` |
| Version polling | `src/hooks/useVersionCheck.ts`, `src/utils/versionManager.ts` |
| Group actions | `src/API/Groups/*Api.ts` (each emits its `internal:*` event) |
| Composer lock (admin-only / removed) | `GroupAdminModeContext`, `RemoveInGroupContext`, `ChatPanel` props → `ChatInput` |
| Media validation/compression | `uploadHelpers.ts` `validateMediaFiles`, `globalFunc.compressImagesToWebP` |

## 20. Traps & notes

Removed as dead code (kept here so you don't go looking for them):
`LoginExists`/`/session-check`/`hasSocketId`, `SesionId` device field,
`userPermissions`/`setPermissions`/`PERMISSION_SET`/`isSyncing`/`startSync` in
LoginData, the `mediaCache` IDB store (dropped via Dexie v4 migration),
`emitGroupDeleted`, `AuthGuard.handleSessionLogout`, and the unconsumed
`ArchieveContext`/`TagsContexts` providers.

Still live quirks:

- `emitInternalMessageSend` returns `false` if socket instance is null — no
  queueing (REST already persisted, so receivers get it on next sync).
- `internal:group_deleted` / `internal:group_info_request` /
  `internal:app_version_update` have receive listeners but no client emits.
- Group `notify()` calls are intentional no-ops (no templates) — toasts only.
- `useServiceRetry.doCheck` always returns false — recovery is driven only by
  real `SERVICE_UP` window events.

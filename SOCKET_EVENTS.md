# TecoChat — Socket.IO Events Reference

Complete documentation of all socket emit (send) and listen (receive) events
used by the Next.js TecoChat client.

## Connection


| URL (local)      | `http://newnextjs.web`                |
| URL (prod)       | `https://apilx.optigoapps.com`         |
| Auth             | `{ token }` passed via `io(url, { auth: { token } })` |

---

## 1. Emit Events (Client → Server)

### 1.1 `internal.store_sockets`

Register the connected socket ID with the server so the server can map
`userId → socketId` for targeted delivery.

**Payload:**

```json
{
  "userId": "4",
  "ufcc": "TECO"
}
```

| Field    | Type     | Description           |
|----------|----------|-----------------------|
| `userId` | `string` | Logged-in user's ID   |
| `ufcc`   | `string` | Company code          |

> Note: this is the only emit that does NOT include a `receiveEvent` field.

---

### 1.2 `internal:msg_send`

Send a chat message (text or media) to a conversation.

The socket module automatically appends `receiveEvent: "internal:msg_receive"`
and also dispatches the payload locally so the sender sees their own message
instantly.

#### Text message payload

Built by `emitTextMessage` in *socketHelpers.ts*:

```json
{
  "Id": "socket-id-or-user-id",
  "ReceiverId": 12,
  "Type": 1,
  "ufcc": "TECO",
  "SenderId": "4",
  "ConversationId": 10,
  "ConversationName": "John Doe",
  "Message": "Hello world",
  "MessageId": 9001,
  "Status": 1,
  "MessageStatus": 1,
  "MessageType": "text",
  "IsEdited": 0,
  "Direction": 0,
  "IsGroup": 0,
  "ReplyTo": 0,
  "Attachments": null,
  "SentAt": "2025-01-15T10:30:00.000Z",
  "SenderName": "alice",
  "RecieverName": "John Doe",
  "SenderEmail": "alice@example.com",
  "FirstName": "Alice",
  "LastName": "Smith",
  "SenderProfilePicture": "https://...",
  "ProfileImageUrl": "https://...",
  "ProfileImage": "https://...",
  "receiveEvent": "internal:msg_receive"
}
```

| Field                  | Type                | Description                                    |
|------------------------|---------------------|------------------------------------------------|
| `Id`                   | `string`            | Sender's socket ID or user ID                  |
| `ReceiverId`           | `number \| number[]` | Recipient ID (array for groups)                |
| `Type`                 | `number`            | Always `1` for text                            |
| `ufcc`                 | `string`            | Company code                                   |
| `SenderId`             | `string`            | Sender's user ID                               |
| `ConversationId`       | `number`            | Conversation ID                                |
| `ConversationName`     | `string`            | Receiver / conversation display name           |
| `Message`              | `string`            | Message body                                   |
| `MessageId`            | `number`            | Server-assigned message ID                     |
| `Status`                | `number`            | `1` = sent                                     |
| `MessageStatus`        | `number`            | `1` = sent                                     |
| `MessageType`          | `string`            | `"text"`                                       |
| `IsEdited`             | `0 \| 1`            | Edit flag                                      |
| `Direction`            | `number`            | `0` = outgoing                                 |
| `IsGroup`              | `0 \| 1`            | Group flag                                     |
| `ReplyTo`              | `number`            | Reply target message ID (`0` = none)           |
| `Attachments`          | `null`              | No attachments for text                        |
| `SentAt`               | `string`            | ISO timestamp                                  |
| `SenderName`           | `string`            | Sender's username                              |
| `RecieverName`         | `string`            | Receiver's display name                        |
| `SenderEmail`          | `string`            | Sender's email                                 |
| `FirstName`            | `string`            | Sender's first name                            |
| `LastName`             | `string`            | Sender's last name                             |
| `SenderProfilePicture` | `string`            | Sender's avatar URL                            |
| `ProfileImageUrl`      | `string`            | Sender's avatar URL (alt)                      |
| `ProfileImage`         | `string`            | Sender's avatar URL (alt)                      |

#### Media message payload

Built by `buildMediaPayload` in *uploadHelpers.ts*:

```json
{
  "ufcc": "TECO",
  "ReceiverId": 12,
  "Id": 9001,
  "MessageId": 9001,
  "SenderId": "4",
  "Direction": 2,
  "Status": 1,
  "MessageStatus": 1,
  "MessageType": "image",
  "Message": "Look at this",
  "Time": "10:30 AM",
  "Date": "2025-01-15",
  "DateTime": "2025-01-15T10:30:00.000Z",
  "mediaItems": [
    {
      "url": "https://...",
      "filename": "photo.jpg",
      "mimeType": "image/jpeg",
      "size": 102400,
      "attachmentId": "att-123"
    }
  ],
  "previewUrl": "https://...",
  "fileName": "photo.jpg",
  "fileType": "image/jpeg",
  "ConversationId": 10,
  "ConversationName": "John Doe",
  "RecieverName": "John Doe",
  "SenderName": "alice",
  "FirstName": "Alice",
  "LastName": "Smith",
  "SenderEmail": "alice@example.com",
  "SenderProfilePicture": "https://...",
  "ProfileImageUrl": "https://...",
  "ProfileImage": "https://...",
  "IsGroup": 1,
  "receiveEvent": "internal:msg_receive"
}
```

| Field                       | Type                | Description                                            |
|-----------------------------|---------------------|--------------------------------------------------------|
| `MessageType`               | `string`            | `"image"` / `"video"` / `"document"` / `"audio"`       |
| `Direction`                 | `number`            | `2` for media                                          |
| `mediaItems`                | `Array<MediaItem>`  | Uploaded media metadata                                |
| `previewUrl`                | `string`            | First uploaded URL (preview)                           |
| `fileName`                  | `string`            | Original file name                                     |
| `fileType`                  | `string`            | MIME type                                              |
| `Time` / `Date` / `DateTime` | `string`           | Formatted timestamps                                   |

---

### 1.3 `internal:msg_read`

Send a read receipt. For groups, the wrapper emits one event per recipient
member (not a single event with an array).

The socket module appends `receiveEvent: "internal:msg_read"`.

**Payload (per recipient):**

```json
{
  "Id": "socket-id-or-user-id",
  "ReceiverId": 12,
  "Status": 2,
  "MessageStatus": 2,
  "IsGroup": 0,
  "ConversationId": 10,
  "ufcc": "TECO",
  "receiveEvent": "internal:msg_read"
}
```

| Field            | Type     | Description                                          |
|------------------|----------|------------------------------------------------------|
| `Id`             | `string` | Sender's socket ID or user ID                        |
| `ReceiverId`     | `number` | Single recipient ID (one emit per member for groups) |
| `Status`         | `number` | `2` = delivered/read, `3` = fully read               |
| `MessageStatus`  | `number` | Same as `Status`                                     |
| `IsGroup`        | `0 \| 1` | Group flag                                           |
| `ConversationId` | `number` | Conversation ID                                      |
| `ufcc`           | `string` | Company code                                         |

> `Status` values: `2` = first emit (messages seen), `3` = second emit
> (messages fully read, only sent after API confirms `MsgRead === 1`).

---

### 1.4 `internal:reaction_send`

Send a reaction on a message.

The socket module appends `receiveEvent: "internal:reaction_receive"`.

**Payload:**

```json
{
  "ufcc": "TECO",
  "userId": "4",
  "SenderId": "4",
  "ReceiverId": 12,
  "ConversationId": 10,
  "MessageId": 9001,
  "ReactionEmojis": "[{\"Reaction\":\"👍\",\"Direction\":0,\"UserId\":4}]",
  "UserName": "alice",
  "FirstName": "Alice",
  "LastName": "Smith",
  "IsGroup": 1,
  "receiveEvent": "internal:reaction_receive"
}
```

### 1.5 `internal:reaction_remove`

Remove a reaction from a message.

The socket module appends `receiveEvent: "internal:reaction_remove_receive"`.

**Payload:**

```json
{
  "ufcc": "TECO",
  "userId": "4",
  "SenderId": "4",
  "ReceiverId": 12,
  "ConversationId": 10,
  "MessageId": 9001,
  "ReactionEmojis": "[{\"Reaction\":\"\",\"Direction\":0,\"UserId\":4}]",
  "UserName": "alice",
  "FirstName": "Alice",
  "LastName": "Smith",
  "receiveEvent": "internal:reaction_remove_receive"
}
```

Same shape as `internal:reaction_send` but `Reaction` is `""` (empty) to
indicate removal.

---

### 1.6 `internal:typing`

Send typing indicator (start/stop).

The socket module appends `receiveEvent: "internal:typing"`.

**Payload:**

```json
{
  "ConversationId": 10,
  "SenderId": "4",
  "ReceiverId": 12,
  "IsGroup": 0,
  "UserName": "alice",
  "FirstName": "Alice",
  "LastName": "Smith",
  "ProfileImageUrl": "https://...",
  "ProfileImage": "https://...",
  "ufcc": "TECO",
  "isTyping": true,
  "receiveEvent": "internal:typing"
}
```

| Field            | Type                | Description                                   |
|------------------|---------------------|-----------------------------------------------|
| `ConversationId` | `number`            | Conversation ID                               |
| `SenderId`       | `string`            | Typing user's ID                              |
| `ReceiverId`     | `number \| number[]` | Recipient(s)                                  |
| `IsGroup`        | `0 \| 1`            | Group flag                                    |
| `isTyping`       | `boolean`           | `true` = started typing, `false` = stopped    |

> Throttled to 1 emit/second. Auto-stops after 1s of inactivity. Emits
> stop-typing when conversation changes or on unmount.

---

### 1.7 `internal:delete_message`

Delete a message for everyone.

The socket module appends `receiveEvent: "internal:delete_message"` and
also dispatches locally so the deleter sees the message removed instantly.

**Payload:**

```json
{
  "ufcc": "TECO",
  "UserId": "4",
  "SenderId": "4",
  "ReceiverId": 12,
  "ConversationId": 10,
  "MessageId": 9001,
  "Message": "This message was deleted.",
  "Message1": "You deleted this message.",
  "MessageType": 1,
  "IsDeletedForEveryone": 1,
  "DateTime": "2025-01-15T10:30:00.000Z",
  "DeletedAt": "2025-01-15T10:30:00.000Z",
  "receiveEvent": "internal:delete_message"
}
```

| Field                  | Type                | Description                          |
|------------------------|---------------------|--------------------------------------|
| `UserId`               | `string`            | Deleter's user ID                    |
| `SenderId`             | `string`            | Same as `UserId`                     |
| `ReceiverId`           | `number \| number[]` | Recipient(s)                        |
| `MessageId`            | `number`            | Message being deleted                |
| `Message`              | `string`            | Replacement text shown to others     |
| `Message1`             | `string`            | Replacement text shown to deleter    |
| `MessageType`          | `number`            | `1`                                  |
| `IsDeletedForEveryone` | `number`            | `1` = delete for everyone            |
| `DateTime`             | `string`            | ISO timestamp                        |
| `DeletedAt`            | `string`            | ISO timestamp                        |

---

### 1.8 `internal:group_created`

Notify all group members that a new group was created.

The socket module appends `receiveEvent: "internal:group_created"`.

**Payload:**

```json
{
  "ufcc": "TECO",
  "eventType": "group_created",
  "conversationId": 25, 
  "ReceiverId": [4, 7, 12],
  "groupName": "Project Team",
  "groupDesc": "Project discussion group",
  "groupProfile": "https://...",
  "conversationData": {
    "ConversationId": 25,
    "ConversationName": "Project Team",
    "SystemMsg": 1
  },
  "createdBy": {
    "userId": "4",
    "name": "alice",
    "email": "alice@example.com"
  },
  "members": [
    { "UserId": 4 },
    { "UserId": 7 },
    { "UserId": 12 }
  ],
  "permissions": {
    "editGroupSettings": 1,
    "sendMessages": 1,
    "addOtherMembers": 0,
    "approveNewMembers": 0
  },
  "timestamp": "2025-01-15T10:30:00.000Z",
  "receiveEvent": "internal:group_created"
}
```

| Field              | Type              | Description                                          |
|--------------------|-------------------|------------------------------------------------------|
| `eventType`        | `string`          | `"group_created"`                                    |
| `conversationId`   | `number`          | New group conversation ID                            |
| `ReceiverId`       | `number[]`        | All member IDs                                       |
| `groupName`        | `string`          | Group name                                           |
| `groupDesc`        | `string`          | Group description                                    |
| `groupProfile`     | `string`          | Group avatar URL                                     |
| `conversationData` | `object`          | Enriched conversation record (`rd` + `SystemMsg: 1`) |
| `createdBy`        | `object`          | `{ userId, name, email }` of creator                 |
| `members`          | `Array<{UserId}>` | Member list                                          |
| `permissions`      | `object`          | Group permission flags (1/0)                         |
| `timestamp`        | `string`          | ISO timestamp                                        |

---

### 1.9 `internal:group_updated`

Notify all members that group info was edited.

The socket module appends `receiveEvent: "internal:group_updated"`.

**Payload:**

```json
{
  "ufcc": "TECO",
  "eventType": "group_updated",
  "conversationId": 25,
  "ReceiverId": [4, 7, 12],
  "conversationData": {
    "ConversationId": 25,
    "ConversationName": "Updated Team Name",
    "GroupDesc": "Updated description",
    "ProfileImageUrl": "https://...",
    "SystemMsg": 1
  },
  "updatedBy": {
    "userId": "4",
    "name": "alice",
    "email": "alice@example.com"
  },
  "changes": {
    "groupName": "Updated Team Name",
    "groupDesc": "Updated description",
    "groupProfile": "https://..."
  },
  "timestamp": "2025-01-15T10:30:00.000Z",
  "receiveEvent": "internal:group_updated"
}
```

| Field              | Type     | Description                                      |
|--------------------|----------|--------------------------------------------------|
| `eventType`        | `string` | `"group_updated"`                                |
| `conversationData` | `object` | Enriched conversation record with updated fields |
| `updatedBy`        | `object` | `{ userId, name, email }` of editor              |
| `changes`          | `object` | Only the changed fields                          |

---

### 1.10 `internal:group_deleted`

Notify all members that a group was deleted.

The socket module appends `receiveEvent: "internal:group_deleted"`.

**Expected payload shape:**

```json
{
  "ufcc": "TECO",
  "eventType": "group_deleted",
  "conversationId": 25,
  "ReceiverId": [4, 7, 12],
  "deletedBy": {
    "userId": "4",
    "name": "alice",
    "email": "alice@example.com"
  },
  "timestamp": "2025-01-15T10:30:00.000Z",
  "receiveEvent": "internal:group_deleted"
}
```

---

### 1.11 `internal:member_added`

Notify all members (including new ones) that members were added to a group.

The socket module appends `receiveEvent: "internal:member_added"`.

**Payload:**

```json
{
  "ufcc": "TECO",
  "eventType": "member_added",
  "conversationId": 25,
  "ReceiverId": [4, 7, 12, 15],
  "conversationData": {
    "ConversationId": 25,
    "SystemMsg": 1
  },
  "addedBy": {
    "userId": "4",
    "name": "alice",
    "email": "alice@example.com"
  },
  "newMembers": [
    { "userId": 15, "name": "newuser" }
  ],
  "newMemberIds": [15],
  "timestamp": "2025-01-15T10:30:00.000Z",
  "receiveEvent": "internal:member_added"
}
```

| Field          | Type                     | Description                            |
|----------------|--------------------------|----------------------------------------|
| `ReceiverId`   | `number[]`               | All existing members + new members     |
| `addedBy`      | `object`                 | `{ userId, name, email }` of adder     |
| `newMembers`   | `Array<{userId, name?}>` | Newly added member details             |
| `newMemberIds` | `number[]`               | New member IDs                         |

---

### 1.12 `internal:member_removed`

Notify all members (including the removed one) that a member was removed or
left a group.

The socket module appends `receiveEvent: "internal:member_removed"`.

**Payload:**

```json
{
  "ufcc": "TECO",
  "eventType": "member_removed",
  "conversationId": 25,
  "ReceiverId": [4, 7, 12],
  "conversationData": {
    "ConversationId": 25,
    "SystemMsg": 1
  },
  "removedBy": {
    "userId": "4",
    "name": "alice",
    "email": "alice@example.com"
  },
  "removedMember": {
    "userId": 12,
    "name": "bob"
  },
  "removedMemberId": 12,
  "reason": "removed",
  "removeInGroup": 1,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "receiveEvent": "internal:member_removed"
}
```

| Field              | Type       | Description                                       |
|--------------------|------------|---------------------------------------------------|
| `ReceiverId`       | `number[]` | All members + removed member                      |
| `removedBy`        | `object`   | `{ userId, name, email }` of remover              |
| `removedMember`    | `object`   | `{ userId, name }` of removed member              |
| `removedMemberId`  | `number`   | Removed member's ID                               |
| `reason`           | `string`   | `"removed"` (kicked) or `"left"` (self-exit)      |
| `removeInGroup`    | `number`   | `1`                                               |

---

### 1.13 `internal:member_promoted`

Notify all members that a member was promoted to admin.

The socket module appends `receiveEvent: "internal:member_promoted"`.

**Payload:**

```json
{
  "ufcc": "TECO",
  "eventType": "member_promoted",
  "conversationId": 25,
  "ReceiverId": [4, 7, 12],
  "conversationData": {
    "ConversationId": 25,
    "SystemMsg": 1
  },
  "changedBy": {
    "userId": "4",
    "name": "alice",
    "email": "alice@example.com"
  },
  "targetMember": {
    "userId": 12,
    "name": "bob"
  },
  "targetMemberId": 12,
  "newRole": "admin",
  "isGroupAdmin": 1,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "receiveEvent": "internal:member_promoted"
}
```

| Field            | Type     | Description                              |
|------------------|----------|------------------------------------------|
| `changedBy`      | `object` | `{ userId, name, email }` of promoter    |
| `targetMember`   | `object` | `{ userId, name }` of promoted member    |
| `targetMemberId` | `number` | Promoted member's ID                     |
| `newRole`        | `string` | `"admin"`                                |
| `isGroupAdmin`   | `number` | `1`                                      |

---

### 1.14 `internal:member_demoted`

Notify all members that an admin was demoted to regular member.

The socket module appends `receiveEvent: "internal:member_demoted"`.

**Payload:**

Same shape as `internal:member_promoted` but:

```json
{
  "eventType": "member_demoted",
  "newRole": "member",
  "isGroupAdmin": 0,
  "receiveEvent": "internal:member_demoted"
}
```

---

### 1.15 `internal:group_permission`

Notify all members that group permissions were changed.

The socket module appends `receiveEvent: "internal:group_permission"`.

**Payload:**

```json
{
  "ufcc": "TECO",
  "eventType": "permission_changed",
  "conversationId": 25,
  "ReceiverId": [4, 7, 12],
  "changedBy": {
    "userId": "4",
    "name": "alice",
    "email": "alice@example.com"
  },
  "permissions": {
    "editGroupSettings": 1,
    "sendMessages": 0,
    "addOtherMembers": 1,
    "approveNewMembers": 0
  },
  "changedPermission": {
    "name": "sendMessages",
    "value": 0
  },
  "timestamp": "2025-01-15T10:30:00.000Z",
  "receiveEvent": "internal:group_permission"
}
```

| Field               | Type     | Description                                |
|---------------------|----------|--------------------------------------------|
| `permissions`       | `object` | Full permission map (all flags)            |
| `changedPermission` | `object` | `{ name, value }` of the specific change   |

---

### 1.16 `internal:group_info_request`

Request group info from the server.

The socket module appends `receiveEvent: "internal:group_info_request"`.

**Expected payload shape:**

```json
{
  "conversationId": 25,
  "ufcc": "TECO",
  "receiveEvent": "internal:group_info_request"
}
```

---

### 1.17 `internal:app_version_update`

Broadcast the current app version to the server (and locally).

The socket module appends `receiveEvent: "internal:app_version_update"`
and `version` from `localStorage["app_version_current"]`.

**Payload:**

```json
{
  "version": "1.2.3",
  "receiveEvent": "internal:app_version_update"
}
```

---

## 2. Receive Events (Server → Client)

All listeners are registered in `initializeSocket()` (*src/socket.ts*) and
dispatched to handler Sets. Components subscribe via `add*Handler()` functions
which return an unsubscribe callback.

### 2.1 `internal:msg_receive`

**Dispatched to:** `internalMessageHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — updates conversation list (last message, unread count)
- `src/components/ChatPanel/CoreLogic/useSocketHandlers.ts` — appends message to active conversation

**Data shape:** Same as the `internal:msg_send` payload (text or media).
The server forwards the message to all recipients with the sender's info.

```json
{
  "Id": 9001,
  "MessageId": 9001,
  "SenderId": "4",
  "ReceiverId": 12,
  "ConversationId": 10,
  "Message": "Hello world",
  "MessageType": "text",
  "Direction": 1,
  "Status": 1,
  "MessageStatus": 1,
  "IsGroup": 0,
  "SentAt": "2025-01-15T10:30:00.000Z",
  "SenderName": "alice",
  "FirstName": "Alice",
  "LastName": "Smith",
  "SenderProfilePicture": "https://...",
  "ufcc": "TECO",
  "receiveEvent": "internal:msg_receive"
}
```

> `Direction: 1` = incoming (from the recipient's perspective).

---

### 2.2 `internal:msg_read`

**Dispatched to:** `internalStatusHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — updates message status in conversation list
- `src/components/ChatPanel/CoreLogic/useSocketHandlers.ts` — updates message status in active chat

**Data shape:**

```json
{
  "Id": "socket-id",
  "ReceiverId": 12,
  "Status": 2,
  "MessageStatus": 2,
  "IsGroup": 0,
  "ConversationId": 10,
  "ufcc": "TECO",
  "receiveEvent": "internal:msg_read"
}
```

| `Status` | Meaning          |
|----------|------------------|
| `2`      | Delivered / seen |
| `3`      | Fully read       |

---

### 2.3 `internal:typing`

**Dispatched to:** `internalTypingHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — shows/hides typing indicator in conversation list

**Data shape:**

```json
{
  "ConversationId": 10,
  "SenderId": "4",
  "ReceiverId": 12,
  "IsGroup": 0,
  "isTyping": true,
  "UserName": "alice",
  "FirstName": "Alice",
  "LastName": "Smith",
  "ProfileImageUrl": "https://...",
  "ufcc": "TECO",
  "receiveEvent": "internal:typing"
}
```

> The handler ignores events where `SenderId === currentUserId`.

---

### 2.4 `internal:delete_message`

**Dispatched to:** `internalMessageDeletionHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — updates conversation list last message
- `src/components/ChatPanel/CoreLogic/useSocketHandlers.ts` — removes/replaces message in active chat

**Data shape:** Same as the `internal:delete_message` emit payload.

```json
{
  "MessageId": 9001,
  "ConversationId": 10,
  "Message": "This message was deleted.",
  "Message1": "You deleted this message.",
  "IsDeletedForEveryone": 1,
  "DeletedAt": "2025-01-15T10:30:00.000Z",
  "ufcc": "TECO",
  "receiveEvent": "internal:delete_message"
}
```

---

### 2.5 `internal:reaction_receive`

**Dispatched to:** `messageReactionHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — updates conversation list
- `src/components/ChatPanel/CoreLogic/useSocketHandlers.ts` — updates reaction in active chat

**Data shape:** Same as the `internal:reaction_send` emit payload.

---

### 2.6 `internal:reaction_send`

**Dispatched to:** `messageReactionHandlers`

> The client listens on the same event it emits on, so it sees its own
> reaction echoed back (if the server broadcasts it).

---

### 2.7 `internal:reaction_remove_receive`

**Dispatched to:** `messageReactionHandlers`

**Data shape:** Same as the `internal:reaction_remove` emit payload.

---

### 2.8 `internal:reaction_remove`

**Dispatched to:** `messageReactionHandlers`

> Same as above — the client listens on its own emit event too.

---

### 2.9 `internal:group_created`

**Dispatched to:** `groupEventHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — adds new group to conversation list, notifies

**Data shape:** Same as the `internal:group_created` emit payload.

---

### 2.10 `internal:group_updated`

**Dispatched to:** `groupEventHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — updates group info in conversation list

**Data shape:** Same as the `internal:group_updated` emit payload.

---

### 2.11 `internal:group_deleted`

**Dispatched to:** `groupEventHandlers`

**Data shape:** Same as the `internal:group_deleted` emit payload.

---

### 2.12 `internal:member_added`

**Dispatched to:** `groupMemberHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — reloads members, notifies

**Data shape:** Same as the `internal:member_added` emit payload.

---

### 2.13 `internal:member_removed`

**Dispatched to:** `groupMemberHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — reloads members, notifies

**Data shape:** Same as the `internal:member_removed` emit payload.

---

### 2.14 `internal:member_promoted`

**Dispatched to:** `groupMemberHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — reloads members, notifies

**Data shape:** Same as the `internal:member_promoted` emit payload.

---

### 2.15 `internal:member_demoted`

**Dispatched to:** `groupMemberHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — reloads members, notifies

**Data shape:** Same as the `internal:member_demoted` emit payload.

---

### 2.16 `internal:group_permission`

**Dispatched to:** `groupPermissionHandlers`

**Registered by:**
- `src/hooks/useConversationList.ts` — notifies of permission change

**Data shape:** Same as the `internal:group_permission` emit payload.

---

### 2.17 `internal:group_info_request`

**Dispatched to:** `groupEventHandlers`

> Server-side group info response. Currently registered but the handler
> in `useConversationList.ts` treats it as a generic group event.

---

### 2.18 `internal:app_version_update`

**Dispatched to:** `appVersionUpdateHandlers`

> Version update notification. Currently registered but no component
> subscribes via `addAppVersionUpdateHandler()` — version checking uses
> HTTP polling in `src/hooks/useVersionCheck.ts`.

## 5. Quick Reference — Emit Summary

| Emit Event                    | Function                  | Caller                          |
|-------------------------------|---------------------------|---------------------------------|
| `internal.store_sockets`       | `emitInternalStoreSocketData` | SocketContext, LoginPage     |
| `internal:msg_send`           | `emitInternalMessageSend` | useMessageActions, useMediaHandlers |
| `internal:msg_read`           | `emitInternalMessageRead` | useReadReceipt                  |
| `internal:reaction_send`      | `emitSendReaction`        | useReactions                    |
| `internal:reaction_remove`    | `emitRemoveReaction`      | useReactions                    |
| `internal:typing`             | `emitInternalTyping`      | useTypingEmitter                |
| `internal:delete_message`     | `emitInternalMessageDelete` | useMessageActions             |
| `internal:group_created`      | `emitGroupCreated`        | CreateGroupApi                  |
| `internal:group_updated`      | `emitGroupUpdated`        | EditGroupApi                    |
| `internal:group_deleted`      | `emitGroupDeleted`        | *(not yet called)*              |
| `internal:member_added`       | `emitMemberAdded`         | AddGroupParticipantApi          |
| `internal:member_removed`     | `emitMemberRemoved`       | RemoveMemberApi                 |
| `internal:member_promoted`    | `emitMemberPromoted`      | AssignRoleApi                   |
| `internal:member_demoted`     | `emitMemberDemoted`       | AssignRoleApi                   |
| `internal:group_permission`   | `emitPermissionChanged`   | ChangeGroupPermissionApi        |
| `internal:group_info_request` | `emitGroupInfoRequest`    | *(not yet called)*              |
| `internal:app_version_update` | `emitAppVersionUpdate`    | *(not yet called)*              |

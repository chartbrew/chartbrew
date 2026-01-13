# Slack Conversation Persistence

## Problem
Previously, the Slack bot was losing conversation context between interactions. Every button click or follow-up question started a fresh conversation with no memory of previous questions, causing:
- Excessive back-and-forth for simple queries
- AI requiring too much handholding
- Lost context after each interaction

## Solution
Implemented persistent conversation sessions per Slack channel using the existing AiConversation and AiMessage models.

## How It Works

### 1. **Conversation Mapping**
Each Slack channel/DM gets its own persistent conversation:
- Stored in `Integration.config.slack_conversations`
- Maps: `channel_id` → `conversation_uuid`
- Automatically created on first message
- Persists across all interactions in that channel

### 2. **Conversation Lifecycle**

```javascript
User: "/chartbrew ask how many users?"
  ↓
Bot creates/loads conversation for this channel
  ↓
Bot: "Which database?" [Button A] [Button B]
  ↓
User clicks [Button A]
  ↓
Bot loads SAME conversation with full history
Bot knows: Original question + selected database
  ↓
Bot: "Here's the count: 1,234 users"
```

### 3. **History Management**
- **Load**: Fetch all `AiMessage` records for the conversation
- **Process**: Send full history to orchestrator
- **Save**: Store new messages and usage records
- **Update**: Keep conversation metadata current

## Implementation Details

### `getSlackConversation(integration, channelId, slackUserId)`
Creates or retrieves a conversation for a Slack channel:
```javascript
const conversationId = await getSlackConversation(integration, channelId, slackUserId);
```

**Logic:**
1. Check if conversation exists for this channel
2. Verify conversation is valid and belongs to team
3. Create new conversation if needed
4. Store mapping in integration config
5. Return conversation UUID

### `handleAsk()` Updated Flow
1. Get or create conversation for channel
2. Load all messages from `AiMessage` table
3. Rebuild conversation history
4. Call orchestrator with full context
5. Save new messages and usage
6. Update conversation metadata

### Data Storage

**Integration Config:**
```json
{
  "slack_conversations": {
    "C01ABC123": "uuid-1234-5678-...",  // channel conversations
    "U01XYZ456": "uuid-abcd-efgh-..."   // DM conversations
  }
}
```

**AiConversation Table:**
- `id`: UUID
- `team_id`: Chartbrew team
- `user_id`: Installer or default user
- `title`: "Slack: {channel_id}"
- `message_count`: Number of user messages
- `status`: "active"

**AiMessage Table:**
- `conversation_id`: Links to AiConversation
- `role`: "user", "assistant", "system", "tool"
- `content`: Message text
- `sequence`: Order in conversation
- `tool_calls`: JSON of tool invocations

**AiUsage Table:**
- `conversation_id`: Links to conversation
- `team_id`: For billing aggregation
- `model`: OpenAI model used
- `prompt_tokens`, `completion_tokens`, `total_tokens`
- `elapsed_ms`: API call duration

## New Command: `/chartbrew reset`

Users can clear conversation history when needed:
```
/chartbrew reset
```

**Effect:**
- Removes conversation mapping for current channel
- Next question starts fresh conversation
- Old conversation remains in database (for audit/billing)

**Use Cases:**
- Switching topics completely
- Conversation became too long/confused
- Want to start over with different context

## Benefits

✅ **Context Retention**: AI remembers original question through entire flow
✅ **Fewer Interactions**: No need to repeat information
✅ **Better Responses**: AI understands full conversation arc
✅ **User Control**: Reset command when starting new topic
✅ **Audit Trail**: All conversations stored for analysis
✅ **Billing Tracking**: Usage records tied to conversations

## Example: Before vs After

### Before (No Persistence)
```
User: "Count users"
Bot: "Which DB?"
User: [Clicks "Internal DB"]
Bot: "Which table?" ← Lost that you wanted to count users!
User: [Clicks "users"]
Bot: "What do you want to know?" ← Completely forgot!
```

### After (With Persistence)
```
User: "Count users"
Bot: "Which DB?"
User: [Clicks "Internal DB"]
Bot: "Great! You have 1,234 users in Internal DB" ← Remembers the goal!
```

## Technical Notes

### Memory Management
- Conversations stay active until reset
- Old messages accumulate in AiMessage table
- Consider periodic cleanup for very old conversations
- Usage records kept indefinitely for billing

### Performance
- Conversation lookup: O(1) from integration config
- Message loading: Indexed query on `conversation_id` + `sequence`
- Minimal overhead per request

### Scalability
- One conversation per channel (not per user)
- Multiple users in a channel share conversation
- Large channels may accumulate many messages
- Consider conversation limits per channel if needed

## Future Enhancements

Potential improvements:
- [ ] Automatic reset after X hours of inactivity
- [ ] Conversation summarization for very long threads
- [ ] Per-user conversations in shared channels
- [ ] Conversation search/browse in Slack
- [ ] Export conversation to Chartbrew web UI

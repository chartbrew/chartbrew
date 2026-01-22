# Slack App Integration

Enables Chartbrew to work as a Slack bot that answers data questions using AI orchestration.

## Architecture

### 3-Layer Structure

1. **`api/SlackRoute.js`** - HTTP endpoints and signature verification
   - `/apps/slack/commands` - Slash commands (`/chartbrew connect`, `/chartbrew status`, etc.)
   - `/apps/slack/oauth/callback` - OAuth installation flow
   - `/apps/slack/auth/complete` - Links Slack workspace to Chartbrew team
   - `/apps/slack/interactions` - Button clicks and modal submissions
   - `/apps/slack/events` - App mentions (`@chartbrew`)

2. **`controllers/SlackController.js`** - Business logic
   - OAuth and team connection flows
   - Question processing via AI orchestrator
   - Conversation management (thread-based persistence)
   - Error handling and message formatting

3. **`utils/slackClient.js`** - Slack API wrapper
   - Signature verification
   - OAuth token exchange
   - Message posting (DMs, channels, response URLs)
   - User permission checks

## Key Flows

### Installation & Connection
1. User installs app from Slack → OAuth callback saves integration (no team link yet)
2. User runs `/chartbrew connect` → receives magic link via DM
3. User opens link in Chartbrew → selects team/project → completes connection
4. Integration now has `team_id` and `apikey_id` to access Chartbrew data

### Ask Questions
1. User mentions `@chartbrew <question>` in channel/thread
2. Bot posts "thinking" message
3. Controller calls AI orchestrator with question and thread conversation history
4. Real-time progress updates shown in Slack
5. Bot updates message with answer (formatted as Block Kit with chart snapshots)
6. Each thread maintains separate conversation context

## Database Models

- **Integration**: Stores Slack workspace connection (type: "slack", external_id: slack_team_id)
  - `config.bot_token` - OAuth bot token
  - `config.bot_user_id` - Bot's user ID
  - `config.default_project_id` - Optional default dashboard
  - `config.slack_conversations` - Maps thread_ts to conversation_id
- **SlackAuthState**: Temporary state tokens for magic link flow (15min expiry)
- **AiConversation**: Thread-specific conversation history
- **AiMessage**: Individual messages in conversation
- **AiUsage**: Token usage tracking per conversation

## Environment Variables

Required:
- `CB_SLACK_CLIENT_ID` - Slack OAuth client ID
- `CB_SLACK_CLIENT_SECRET` - Slack OAuth client secret
- `CB_SLACK_SIGNING_SECRET` - Request signature verification
- `VITE_APP_CLIENT_HOST` - Frontend URL for magic links

## Maintenance Tips

### Adding New Commands
1. Add route in `SlackRoute.js` under commands switch
2. Create handler method in `SlackController.js`
3. Use `postResponseUrl()` for immediate responses or `postMessage()` for bot token

### Updating AI Behavior
- Question processing happens in `processQuestionInThread()`
- Conversation history is thread-specific (stored in Integration config)
- Modify `formatResponse()` in `utils/formatResponse.js` to change Block Kit formatting

### Debugging
- All endpoints acknowledge Slack within 3 seconds (prevents timeout errors)
- Check `thinkingMessageTs` is set before updating messages
- Signature verification is lenient in development mode
- Error messages use `formatError()` for consistent Block Kit styling

### Common Issues
- **"Invalid signature"**: Check raw body is available for signature verification
- **Message not updating**: Verify `thread_ts` matches original message
- **No bot token**: Integration exists but isn't connected to team (run `/chartbrew connect`)
- **Conversation context lost**: Check `slack_conversations` mapping in Integration config

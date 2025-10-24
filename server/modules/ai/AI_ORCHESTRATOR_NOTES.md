# AI Orchestrator - Implementation Notes

## Overview
The orchestrator enables conversational AI interactions for data queries and chart creation in Chartbrew. It uses OpenAI's function calling API to orchestrate a multi-step workflow.

## Current Implementation

### ✅ Completed
- **Semantic Layer**: Builds context from team's connections, projects, datasets, and chart catalog
- **System Prompt**: Generates dynamic prompts explaining Chartbrew's data model and available resources
- **Function Calling Loop**: Implements OpenAI tool calling with parallel execution
- **Disambiguation Support**: Can pause execution to ask users for clarification
- **Team Context Injection**: Automatically injects team_id into tools that need it
- **All Core Tools Implemented**:
  - `list_connections`: Queries DB for connections, optionally filtered by project
  - `get_schema`: Returns cached schema from connection entity
  - `generate_query`: Uses existing `generateSqlQuery.js` module + validates for forbidden keywords
  - `run_query`: Executes queries via ConnectionController (postgres, mysql, mongodb, clickhouse)
  - `summarize`: Uses AI for natural language summaries
  - `suggest_chart`: Uses AI for chart type recommendations
  - `create_dataset`: Creates Dataset and DataRequest records with proper linking
  - `create_chart`: Creates Chart and ChartDatasetConfig with dashboard ordering
  - `disambiguate`: Pauses execution for user input

### 🚧 Needs Enhancement (Optional)
- `validate_query`: Currently returns placeholder, could add dry-run validation
- `get_schema`: Could add sample data extraction
- Error recovery: AI could auto-retry with corrections

## Architecture Considerations

### Conversation State Management
- Current: Returns full conversation history with each response
- Consider: Store conversations in DB with a session_id for resumability
- Frontend needs to maintain conversation context between requests

### Error Handling
- Tool errors are caught and returned to AI for self-correction
- Max 10 iterations to prevent infinite loops
- Need frontend error boundaries for AI failures

### Security
- ✅ Read-only query enforcement (needs implementation in run_query)
- ✅ Team-scoped data access
- ⚠️ TODO: Rate limiting on AI API calls
- ⚠️ TODO: Query cost estimation before execution

### Performance
- ✅ Parallel tool execution with Promise.all
- ✅ Cached schemas from connection entities
- ⚠️ Consider caching semantic layer (changes infrequently)
- ⚠️ Semantic layer can get large for teams with many connections/projects

## Next Steps

### ✅ Phase 1: Core Functionality - COMPLETED
1. ✅ Implement `generate_query` using existing SQL generation module
2. ✅ Implement `validate_query` with connection handlers
3. ✅ Implement `run_query` with security guardrails
4. ✅ Test full query workflow: question → schema → query → execute → summarize

### ✅ Phase 2: Chart Creation - COMPLETED
1. ✅ Implement `create_dataset` with proper DataRequest creation
2. ✅ Implement `create_chart` with layout calculation
3. 🔲 Add chart preview generation (return chart config for frontend preview)
4. 🔲 Test full chart workflow: question → chart suggestion → creation

### Phase 3: Frontend Integration & Testing (Next Priority)
1. Build frontend chat UI component
2. Add action buttons for disambiguation
3. Add chart preview before creation
4. Implement project selector for chart placement
5. End-to-end testing with real user scenarios

### Phase 4: Enhanced UX (Week 3-4)
1. Add conversation persistence (DB table: `ai_conversations`)
2. Implement smarter connection disambiguation (use entity name hints)
3. Add query explanation alongside results
4. Support chart editing/refinement through conversation
5. Add chart templates based on common query patterns
6. Better error messages and recovery suggestions

### Phase 5: Advanced Features (Future)
1. Multi-dataset charts (JOIN multiple connections)
2. Natural language filters ("signups from last week")
3. Scheduled AI reports ("send me weekly signups every Monday")
4. Learning from user corrections (fine-tuning)
5. Support for API connections (not just SQL databases)
6. Query optimization suggestions
7. Data quality warnings

## Usage Example

```javascript
const { orchestrate } = require("./modules/ai/orchestrator");

// Simple question
const result = await orchestrate(
  teamId, 
  "How many users signed up today?",
  [] // empty conversation history for first message
);

console.log(result.message); // "You had 23 new signups today."

// Follow-up with context
const followUp = await orchestrate(
  teamId,
  "Show me a chart of signups for the last 7 days",
  result.conversationHistory
);

// If needs user input (disambiguation)
if (followUp.needs_user_input) {
  // Present followUp.options to user
  // After user selects, continue with:
  const final = await orchestrate(
    teamId,
    followUp.options[0].value, // user's selection
    followUp.conversationHistory
  );
}
```

## Integration Points

### Frontend Requirements
- Chat UI component with conversation display
- Action buttons for disambiguation options
- Chart preview component (before creation)
- Project selector for chart placement
- Conversation history sidebar

### Backend Endpoints
```
POST /api/ai/chat
  Body: { teamId, question, conversationHistory? }
  Response: { message, conversationHistory, needs_user_input?, usage }

POST /api/ai/continue
  Body: { teamId, conversationHistory, userChoice }
  Response: { message, conversationHistory, usage }
```

### Existing Modules to Leverage
- `server/connections/*`: Connection handlers for each DB type
- `server/modules/ai/generateSqlQuery.js`: SQL generation logic
- `server/controllers/DatasetController.js`: Dataset creation patterns
- `server/controllers/ChartController.js`: Chart creation patterns
- `server/charts/AxisChart.js`: Chart data processing

## Known Limitations

1. **Schema Quality**: Cached schemas may be outdated or incomplete
   - Consider periodic schema refresh
   - Allow manual schema triggers

2. **Query Complexity**: AI may struggle with complex JOINs or aggregations
   - Start with single-table queries
   - Add complexity incrementally

3. **Token Limits**: Large semantic layers may exceed context windows
   - Implement smart filtering (only relevant connections/projects)
   - Use embeddings for semantic search over schemas

4. **Cost**: Each conversation can use many tokens with tool calls
   - Implement usage tracking per team
   - Add usage limits or quotas
   - Consider cheaper models for simpler tasks

## Testing Strategy

1. **Unit Tests**: Each tool function independently
2. **Integration Tests**: Full orchestration flows
3. **E2E Tests**: Frontend → backend → AI → database roundtrips
4. **User Testing**: Beta with select teams, gather feedback

## Monitoring & Observability

Consider adding:
- Tool call frequency and success rates
- Average tokens used per conversation
- Most common user questions (for optimization)
- Query generation accuracy (user corrections as signal)
- Chart creation success rate
- Conversation abandonment points


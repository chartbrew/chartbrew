# AI Orchestrator Module

This module provides AI-powered conversational interactions for Chartbrew.

## Files Overview

- **`orchestrator.js`** - Main entry point for AI interactions. Handles OpenAI function calling and workflow orchestration.
- **`responseParser.js`** - Parses AI responses and emits progress events to frontend.
- **`generateSqlQuery.js`** - Generates SQL queries from natural language using OpenAI.
- **`entityCreationRules.js`** - Configuration for how AI creates Chartbrew entities (datasets, charts, etc.)

## Customizing Entity Creation

The AI follows structured rules when creating datasets, charts, and related entities. These rules are defined in `entityCreationRules.js`.

### Quick Edit Guide

To modify how the AI creates entities:

1. **Open `entityCreationRules.js`**
2. **Edit the `ENTITY_CREATION_RULES` string** - This is what the AI sees in its instructions
3. **Update `FIELD_SPECS`** (optional) - For programmatic validation in the future
4. **Modify `DEFAULTS`** (optional) - Default values and options

### Example Customizations

**Change default chart size:**
```javascript
// In ENTITY_CREATION_RULES string
"Default chartSize=3, displayLegend=true, includeZeros=true"

// In FIELD_SPECS
recommended: {
  draft: false,
  chartSize: 3,  // Changed from 2 to 3
  ...
}
```

**Add new chart type guidance:**
```javascript
// In DEFAULTS.chartTypes
chartTypes: {
  ...existing types...,
  scatter: "correlation between two variables"
}
```

**Modify creation sequence:**
```javascript
// In ENTITY_CREATION_RULES string
**Creation Sequence:**
1. Create Dataset (with connection_id, legend, draft=false)
2. Create DataRequest (with dataset_id, connection_id, query)
3. Update Dataset.main_dr_id → DataRequest.id
// Add your custom step here
4. Validate query results
5. Create Chart (with project_id, name, type, draft=false)
...
```

## Token Optimization

The rules are designed to be concise while remaining clear. Keep modifications:
- **Bullet-point format** - Easy to parse, minimal tokens
- **Abbreviations okay** - "dr" for data request, "ID" instead of "identifier"
- **No examples** - Rules only, implementation handles examples
- **Group related items** - Reduces repetition

### Token Counts (approximate)
- `ENTITY_CREATION_RULES`: ~280 tokens
- Full system prompt: ~600-800 tokens (varies with projects/connections)
- Per message overhead: ~50 tokens

## Testing Changes

After modifying rules:

1. **Test basic workflow:**
   - "Show me users from my database"
   - "Create a chart of sales over time"

2. **Check entity creation:**
   - Verify datasets have `draft=false`
   - Confirm `main_dr_id` is set correctly
   - Check charts appear on dashboard

3. **Validate error handling:**
   - Ask for non-existent connections
   - Request invalid chart types

## Common Tweaks

### Make all charts draft by default
```javascript
// In ENTITY_CREATION_RULES
- Set draft=true until user confirms
```

### Add custom validation rules
```javascript
// Add to Creation Sequence
4. Validate query returns data before creating chart
```

### Change default time interval
```javascript
// In Chart Creation section
- Default timeInterval=week (was: day)
```

## Architecture Notes

The orchestrator uses OpenAI's function calling to:
1. Detect user intent
2. Call appropriate tools (list_connections, generate_query, etc.)
3. Execute database operations
4. Create visualization entities
5. Return results to user

Entity creation rules guide the AI in steps 4-5 to ensure proper database relationships and field values.


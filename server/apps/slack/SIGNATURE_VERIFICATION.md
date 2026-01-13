# Slack Signature Verification

## Current Implementation

### Development Mode (Current)
- Signature verification is **lenient** for interactive payloads
- Allows testing without perfect signature matching
- Interactive buttons work by bypassing strict verification

### The Issue
Slack signature verification requires the **exact raw body** that was sent, byte-for-byte. When Express's body-parser processes the request:
1. It consumes the request stream
2. Parses URL-encoded data into `req.body` object
3. The original byte order and encoding are lost
4. Reconstructing from parsed body may not match exactly

This affects **interactive payloads** (button clicks, modal submissions) more than commands because:
- Interactive payloads contain large JSON strings in the `payload` field
- Special characters get encoded differently during reconstruction
- Parameter order may differ

## Current Behavior

### What Works
✅ `/chartbrew` commands (mostly reliable)
✅ Interactive buttons in **development mode** (bypassed)

### What May Fail
⚠️ Interactive buttons in **production** (strict verification)
⚠️ Modal submissions in **production**

## Development Bypass

In `server/apps/slack/utils/slackClient.js`:

```javascript
// In development, allow interactive payloads to proceed for testing
if (process.env.NODE_ENV !== "production" && req.body && req.body.payload) {
  console.warn("Allowing interactive payload in development mode");
  return true;
}
```

This allows interactive features to work while developing.

## Production Setup (Recommended)

### Option 1: Configure Body Parser with Raw Body (Recommended)

In `server/index.js`, replace:

```javascript
app.use(urlencoded({ extended: true }));
```

With:

```javascript
app.use(urlencoded({ 
  extended: true,
  verify: (req, res, buf, encoding) => {
    // Save raw body for Slack signature verification
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));
```

This captures the raw body **before** parsing, making signature verification accurate.

### Option 2: Slack SDK (Alternative)

Use `@slack/bolt` framework which handles signature verification internally:

```javascript
const { App } = require('@slack/bolt');

const slackApp = new App({
  signingSecret: process.env.CB_SLACK_SIGNING_SECRET,
  token: botToken,
});
```

### Option 3: Disable Verification (Not Recommended)

Only for testing/internal use:

```javascript
// In slackClient.js verifySignature()
if (!slackSigningSecret) {
  return true; // Always allow
}
```

⚠️ **Security Risk**: Anyone can send fake Slack requests

## Testing Signature Verification

### Check Logs
When verification fails, you'll see:
```
Invalid Slack signature - this may be due to body parsing
Expected: v0=abc123...
Computed: v0=xyz789...
```

### Verify Environment Variables
```bash
echo $CB_SLACK_SIGNING_SECRET
```

Should be set to your Slack app's signing secret from:
https://api.slack.com/apps → Your App → Basic Information → Signing Secret

### Test Interactive Components

1. **Send a command** that returns buttons:
   ```
   /chartbrew ask how many users?
   ```

2. **Click a button** - should work in development
3. **Check server logs** for signature warnings

## Current Status

✅ **Development**: Interactive buttons work (with bypass)  
⚠️ **Production**: May need Option 1 implementation

## Recommendation

For production deployment:
1. Implement **Option 1** (raw body capture)
2. Test signature verification in staging
3. Remove development bypass once verified

## Security Notes

- Signature verification protects against:
  - Forged requests pretending to be from Slack
  - Replay attacks (old requests being resent)
  - Man-in-the-middle modifications

- Without proper verification:
  - Attackers could trigger commands
  - Fake data could be injected
  - Billing could be manipulated

## Implementation Checklist

For production readiness:

- [ ] Add raw body capture to `server/index.js`
- [ ] Test signature verification in staging
- [ ] Verify interactive components work
- [ ] Remove development bypass
- [ ] Test with production Slack app
- [ ] Monitor logs for verification failures
- [ ] Document any signature failures

## Troubleshooting

### Interactive Buttons Return 401

**Symptom**: Clicking buttons shows "Invalid Slack signature"

**Solution**: Either:
1. Ensure `NODE_ENV !== "production"` for development
2. Implement Option 1 raw body capture
3. Check signing secret is correct

### Commands Work But Buttons Don't

**Cause**: Commands have smaller payloads that reconstruct accurately, buttons have large JSON that doesn't

**Solution**: Implement Option 1 (raw body capture)

### Signatures Always Fail

**Check**:
1. Signing secret is correct
2. No proxy/gateway modifying requests
3. Request isn't too old (>5min)
4. Headers include `x-slack-signature` and `x-slack-request-timestamp`

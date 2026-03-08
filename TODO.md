# TODO - Fix AI Issues

## Task: Fix ClassInstruct AI

### Issues Identified:
1. Missing profile image: `img/ellipse-13.png` (file doesn't exist)
2. CSS class mismatch: app.js uses `.user-message` and `.ai-message` but styles.css uses `.message-user` and `.message-ai`
3. Missing `.typing-message` CSS styles in styles.css

### Fix Plan:
- [x] 1. Update styles.css to add `.user-message` and `.ai-message` classes
- [x] 2. Add `.typing-message` styles for typing indicator animation
- [x] 3. Fix profile image in classinstruct-ai.html (use fallback SVG)

### Status: ✅ COMPLETED


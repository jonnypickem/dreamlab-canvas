# Canvas Intelligence - Complete Spec

## Tier System

| Tier | Icon | Auto-Tag | Cost | What It Does |
|------|------|----------|------|--------------|
| **Quick** | ⚡ | ✅ | Free | Regex extract from URL/filename + color sampling |
| **Smart** | 🧠 | ✅ | ~$0.02/100 | Text LLM interprets metadata context |
| **Deep** | 👁️ | ✅ (queued) | ~$0.15/100 | Vision AI analyzes image content |
| **Ultra** | ✨ | ✅ (queued) | ~$0.17/100 | Smart + Deep combined |

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/services/geminiText.js` | Smart tier - text LLM interpretation |
| `src/services/geminiVision.js` | Deep tier - vision analysis |
| `src/utils/saveItemWithTags.js` | Routes by workspace tier setting |
| `src/utils/metadataExtractor.js` | Quick tier - regex/color extraction |
| `src/components/SettingsModal.jsx` | Intelligence tab with tier selector |
| `src/components/ItemModal.jsx` | ✨ Enhance with AI button |

---

## Workspace Settings

Settings → Intelligence → Select tier:
- ⚡ Quick (Free)
- 🧠 Smart (~$0.02/100)
- 👁️ Deep (~$0.15/100)  
- ✨ Ultra (~$0.17/100)

Setting persists to `workspace.intelligenceLevel` in localStorage.

---

## Enhance Button

The **✨ Enhance with AI** button in ItemModal:
- Visible only for `type: 'image'`
- Always runs Ultra-level analysis
- Updates item with new AI tags
- Shows loading state while processing

---

## Future Enhancements

- Batch enhance via SelectionToolbar
- Project-wide enhance with cost warning
- Usage tracking dashboard
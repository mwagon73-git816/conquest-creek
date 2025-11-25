# Auto-Save Implementation Guide

This document describes the auto-save pattern implemented in the Conquest of the Creek application and provides guidance for adding auto-save to additional components.

## Overview

Auto-save functionality automatically saves user changes after a debounce delay, eliminating the need for manual "Save" buttons in appropriate scenarios. This improves user experience by ensuring data is never lost and reduces cognitive load.

## Core Components

### 1. `useAutoSave` Hook (`src/hooks/useAutoSave.js`)

A React hook that handles debounced auto-saving with status tracking.

**Features:**
- Configurable debounce delay (default 2 seconds)
- Data change detection using JSON comparison
- Save status tracking (isSaving, lastSaved, hasUnsavedChanges)
- Error handling
- Can be enabled/disabled conditionally
- Success/error callbacks

**Basic Usage:**
```javascript
import { useAutoSave } from '../hooks/useAutoSave';

const MyComponent = () => {
  const [data, setData] = useState({ value: '' });

  const autoSave = useAutoSave(
    async (dataToSave) => {
      // Save function - must return a Promise
      await updateDataInDatabase(dataToSave);
    },
    data, // Data to watch for changes
    {
      delay: 2000,           // Debounce delay in ms
      enabled: true,         // Whether auto-save is active
      onSuccess: () => {},   // Called after successful save
      onError: (err) => {}   // Called on save error
    }
  );

  return (
    <div>
      <input
        value={data.value}
        onChange={(e) => setData({ value: e.target.value })}
      />
      {/* Use autoSave.isSaving, autoSave.lastSaved, etc. */}
    </div>
  );
};
```

**Alternative: `useAutoSaveOnBlur` Hook**

For form fields where you want to save only when user leaves the field:

```javascript
import { useAutoSaveOnBlur } from '../hooks/useAutoSave';

const { isSaving, onBlur } = useAutoSaveOnBlur(
  async (data) => await updateField(data),
  fieldData
);

<input onBlur={onBlur} ... />
```

### 2. `SaveStatusIndicator` Component (`src/components/SaveStatusIndicator.jsx`)

Visual feedback component showing save status.

**States:**
- **Saving**: Blue spinner with "Saving..." text
- **Saved**: Green checkmark with "Saved Xs ago" text
- **Unsaved changes**: Yellow clock with "Unsaved changes" text
- **Error**: Red alert icon with error message

**Usage:**
```javascript
import SaveStatusIndicator from './SaveStatusIndicator';

<SaveStatusIndicator
  isSaving={autoSave.isSaving}
  lastSaved={autoSave.lastSaved}
  hasUnsavedChanges={autoSave.hasUnsavedChanges}
  error={autoSave.error}
  compact={false} // Use true for smaller version
/>
```

**Icon-Only Variant:**
```javascript
import { SaveStatusIconOnly } from './SaveStatusIndicator';

<SaveStatusIconOnly {...autoSave} />
```

## Implementation Pattern

### Step 1: Create Update Handler in Parent Component

Add an update handler function in the parent component (usually `App.jsx`):

```javascript
const handleUpdateEntity = async (entityId, updates) => {
  console.log('📝 Updating entity:', entityId, updates);

  const entityIndex = entities.findIndex(e => e.id === entityId);
  if (entityIndex === -1) {
    console.error('❌ Entity not found:', entityId);
    return;
  }

  const oldEntity = entities[entityIndex];
  const updatedEntity = { ...oldEntity, ...updates };
  const updatedEntities = [...entities];
  updatedEntities[entityIndex] = updatedEntity;

  // Update state first
  setEntities(updatedEntities);

  // Auto-save to Firebase
  try {
    const result = await storage.setEntities(
      JSON.stringify(updatedEntities),
      dataVersions.entities
    );

    if (result?.success) {
      setDataVersions(prev => ({ ...prev, entities: result.version }));
      console.log('✅ Entity update auto-saved');

      // Log the update
      addLog(
        ACTION_TYPES.ENTITY_UPDATED,
        { entityId, updates },
        entityId,
        oldEntity,
        updatedEntity
      );
    } else if (result?.conflict) {
      handleConflict('entities', result.serverVersion, result.clientVersion);
    }
  } catch (error) {
    console.error('❌ Error auto-saving entity update:', error);
    // Keep local update even if save fails
  }
};
```

### Step 2: Pass Handler as Prop

Pass the update handler to the child component:

```javascript
<MyComponent
  entities={entities}
  onUpdateEntity={handleUpdateEntity}
  // ... other props
/>
```

### Step 3: Implement Auto-Save in Child Component

```javascript
import React, { useState } from 'react';
import { useAutoSave } from '../hooks/useAutoSave';
import SaveStatusIndicator from './SaveStatusIndicator';

const MyComponent = ({ entity, onUpdateEntity }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(entity.fieldName);

  // Auto-save when editing
  const autoSave = useAutoSave(
    async (data) => {
      if (onUpdateEntity) {
        await onUpdateEntity(entity.id, { fieldName: data.value });
      }
    },
    { value: editValue },
    {
      delay: 2000,
      enabled: isEditing // Only auto-save when editing
    }
  );

  return (
    <div>
      {isEditing ? (
        <div>
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
          />
          <button onClick={() => setIsEditing(false)}>Done</button>

          <SaveStatusIndicator {...autoSave} compact />
        </div>
      ) : (
        <div>
          <span>{entity.fieldName}</span>
          <button onClick={() => setIsEditing(true)}>Edit</button>
        </div>
      )}
    </div>
  );
};
```

## Real-World Example: Photo Captions

The first auto-save implementation in the app is for photo captions in the Media Gallery.

**Implementation Details:**
- **Location**: `src/components/MediaGallery.jsx`
- **Parent Handler**: `handleUpdatePhoto` in `src/App.jsx`
- **Risk Level**: LOW (captions are non-critical metadata)
- **UI**: Edit button in lightbox for directors only
- **Debounce**: 2 seconds after user stops typing

**Key Code Snippets:**

Parent handler (`App.jsx`):
```javascript
const handleUpdatePhoto = async (photoId, updates) => {
  // Find photo, create updated version, update state
  // Auto-save to Firebase with conflict detection
  // Log the update with ACTION_TYPES.PHOTO_UPDATED
};
```

Child component (`MediaGallery.jsx`):
```javascript
// State for editing
const [editingCaption, setEditingCaption] = useState(false);
const [captionText, setCaptionText] = useState('');

// Auto-save hook
const captionAutoSave = useAutoSave(
  async (data) => {
    const photo = filteredPhotos[lightboxIndex];
    await onUpdatePhoto(photo.id, { caption: data.caption });
  },
  { caption: captionText },
  {
    delay: 2000,
    enabled: editingCaption && lightboxOpen
  }
);

// UI with edit button and save indicator
{editingCaption ? (
  <div>
    <input
      value={captionText}
      onChange={(e) => setCaptionText(e.target.value)}
    />
    <SaveStatusIndicator {...captionAutoSave} compact />
  </div>
) : (
  <div>
    <span>{photo.caption}</span>
    <button onClick={() => setEditingCaption(true)}>Edit</button>
  </div>
)}
```

## Safety Guidelines

### When to Use Auto-Save

✅ **LOW RISK - Start Here:**
- Photo captions
- Team names and descriptions
- Player profile information (bio, contact info)
- Display preferences
- Non-critical metadata

✅ **MEDIUM RISK - After LOW RISK is Tested:**
- Team roster changes (with confirmation)
- Player NTRP ratings (with validation)
- Match scheduling (pre-confirmation)
- Challenge details (pre-acceptance)

❌ **HIGH RISK - Keep Manual Save:**
- Match results entry (requires explicit submission)
- Challenge acceptance/rejection (requires confirmation)
- Player deletions (requires confirmation)
- Data imports/exports (requires review)
- Financial/scoring data (requires verification)

### Safety Checklist

Before implementing auto-save for a feature:

- [ ] **Data Integrity**: Is the operation protected by Firestore transactions or timestamp validation?
- [ ] **User Intent**: Is the change clearly intentional (not accidental)?
- [ ] **Reversibility**: Can mistakes be easily undone?
- [ ] **Conflict Detection**: Does the save operation check for conflicts?
- [ ] **Visual Feedback**: Is the save status clearly visible to users?
- [ ] **Debouncing**: Are rapid changes properly debounced?
- [ ] **Error Handling**: Are errors gracefully handled with retry options?
- [ ] **Activity Logging**: Are changes logged with before/after states?

## Best Practices

### 1. Debounce Configuration

- **Text inputs**: 2 seconds (default) - wait for user to stop typing
- **Dropdown changes**: 1 second - shorter delay for discrete changes
- **Toggle switches**: 500ms - nearly immediate
- **On blur**: Use `useAutoSaveOnBlur` for explicit field exit

### 2. Enable/Disable Auto-Save

Only enable auto-save when actively editing:

```javascript
const autoSave = useAutoSave(
  saveFunction,
  data,
  {
    enabled: isEditing && hasPermission && !isLoading
  }
);
```

### 3. Visual Feedback

Always show save status:
- Use `SaveStatusIndicator` for text fields
- Use `SaveStatusIconOnly` for compact spaces
- Position near the editable field
- Include explanatory text: "Changes auto-save after 2 seconds"

### 4. Error Recovery

Handle save failures gracefully:

```javascript
const autoSave = useAutoSave(
  saveFunction,
  data,
  {
    onError: (error) => {
      // Keep local changes
      // Show user-friendly error message
      // Offer retry or manual save option
      showError('Auto-save failed. Your changes are saved locally.');
    }
  }
);

{autoSave.error && (
  <button onClick={autoSave.triggerSave}>
    Retry Save
  </button>
)}
```

### 5. Navigation Handling

Reset editing state when navigating:

```javascript
// When switching between items
const handleItemChange = (newIndex) => {
  setCurrentIndex(newIndex);
  setEditingField(false); // Stop editing
  setFieldValue(items[newIndex].field); // Reset to new item's value
};
```

### 6. Conflict Detection

Always include timestamp validation for auto-saved data:

```javascript
const result = await storage.setData(
  data,
  currentVersion // Include version for conflict detection
);

if (result?.conflict) {
  // Show conflict resolution UI
  handleConflict(result);
}
```

## Future Implementation Roadmap

### Phase 1: LOW RISK (Current Phase - COMPLETE)
- ✅ Photo captions in Media Gallery

### Phase 2: LOW RISK (Next Priority)
- [ ] Team names and descriptions in Teams Management
- [ ] Player profile fields (phone, email, bio)
- [ ] Display preferences and settings

### Phase 3: MEDIUM RISK
- [ ] Team roster changes (add/remove players)
- [ ] Player NTRP ratings
- [ ] Match scheduling dates/times
- [ ] Challenge invitation details

### Phase 4: KEEP MANUAL SAVE
- Match results entry (requires explicit submission)
- Challenge acceptance/rejection
- Data imports/exports
- Deletions (require confirmation)

## Testing Checklist

When implementing auto-save for a new feature:

- [ ] **Debounce works**: Changes don't save until user stops editing
- [ ] **Status updates**: Indicator shows "Saving...", "Saved", "Unsaved"
- [ ] **Conflict handling**: Concurrent edits are detected and handled
- [ ] **Error recovery**: Failed saves show errors and allow retry
- [ ] **Navigation**: Editing state resets when navigating away
- [ ] **Permissions**: Only authorized users can trigger auto-save
- [ ] **Activity logging**: Changes are logged with before/after states
- [ ] **Build success**: No TypeScript or linting errors
- [ ] **Manual test**: Actually test in browser with realistic scenarios
- [ ] **Network failure**: Test behavior when offline or with slow connection

## Troubleshooting

### Auto-Save Not Triggering

**Check:**
1. Is `enabled` option set to true?
2. Is the data actually changing? (Check with `JSON.stringify`)
3. Is the component still mounted during the debounce period?
4. Are there any JavaScript errors in the console?

### Save Status Not Updating

**Check:**
1. Are you destructuring all auto-save return values?
2. Is `SaveStatusIndicator` receiving all required props?
3. Is the component re-rendering after state changes?

### Conflicts Occurring Frequently

**Solutions:**
1. Increase debounce delay to reduce save frequency
2. Implement optimistic locking with better version tracking
3. Add user awareness: show "Someone else is editing" indicator

### Data Loss on Navigation

**Solutions:**
1. Add "unsaved changes" warning before navigation
2. Implement `beforeunload` handler for page refresh
3. Save to localStorage as backup before unmounting

## Architecture Notes

### Why Auto-Save Instead of Manual Save Buttons?

**Benefits:**
- Prevents data loss from forgotten saves
- Reduces cognitive load (users don't need to remember to save)
- Modern UX pattern (like Google Docs, Notion, etc.)
- Better mobile experience (fewer buttons)

**Tradeoffs:**
- Requires careful debouncing to avoid excessive saves
- Needs clear visual feedback so users know changes are saved
- Must handle conflicts more gracefully
- Slightly more complex error handling

### Firebase Integration

Auto-save integrates with existing Firebase patterns:
- Uses timestamp validation for conflict detection
- Maintains activity logging for audit trails
- Respects user roles and permissions
- Preserves data versioning

### Performance Considerations

- Debouncing prevents excessive Firebase writes
- Data change detection avoids unnecessary saves
- Optimistic updates keep UI responsive
- Error handling preserves local changes if save fails

## Related Files

- `/src/hooks/useAutoSave.js` - Core auto-save hook
- `/src/components/SaveStatusIndicator.jsx` - Visual feedback component
- `/src/components/MediaGallery.jsx` - First implementation (photo captions)
- `/src/App.jsx` - Parent handlers and state management
- `/src/services/storage.js` - Firebase integration with conflict detection

## Support

For questions or issues with auto-save implementation:
1. Review this documentation
2. Check the photo caption implementation as a reference
3. Test in isolation before integrating
4. Add comprehensive error logging

---

**Last Updated**: 2025-01-23
**Implementation Status**: Phase 1 Complete (Photo Captions)
**Next Priority**: Phase 2 (Team Names, Player Profiles)

# Seasonal Header Images Guide

## Overview
The Conquest of the Creek application now features automatic seasonal header images that change based on the current date. This creates an engaging, festive experience throughout the tournament season.

## How It Works

The system automatically selects the appropriate header image and color scheme based on the current date:

| Date Range | Theme | Colors | Image File |
|------------|-------|--------|------------|
| **November** | Autumn/Thanksgiving | Warm autumn oranges & browns | `tennis-court-autumn.jpg` |
| **December** | Winter/Christmas | Cool winter blues | `tennis-court-winter.jpg` |
| **January** | New Year | Fresh indigo/purple | `tennis-court-newyear.jpg` |
| **February** | Late Winter | Classic blue | `tennis-court-latewinter.jpg` |
| **Other months** | Default | Blue | `tennis-court.jpg` (existing) |

## Adding Seasonal Images

### File Requirements
- **Location**: Place images in `src/assets/` directory
- **Format**: JPG or WebP (WebP preferred for better compression)
- **Dimensions**: 1920x1080px minimum (16:9 aspect ratio)
- **File Size**: Target 150-200KB (optimize before adding)
- **Subject**: Tennis court with seasonal elements

### Image Guidelines for Each Season

#### November - Autumn/Thanksgiving Theme
**Filename**: `tennis-court-autumn.jpg`
- Tennis court in golden afternoon/sunset light
- Warm color grading (oranges, reds, golds, browns)
- Optional: Subtle autumn leaves at edges
- Focus: Tennis court should still be clearly visible
- Mood: Warm, inviting, harvest season

**AI Image Prompt Example**:
```
"Professional tennis court photographed during golden hour in autumn, warm orange and golden lighting, subtle fall foliage around edges, realistic, high quality, 16:9 aspect ratio"
```

#### December - Winter/Christmas Theme
**Filename**: `tennis-court-winter.jpg`
- Tennis court with light snow or frost elements
- Cool, crisp winter lighting
- Optional: Warm festive lights around court edges, holly decorations
- Focus: Maintain tennis court visibility
- Mood: Festive, cozy winter evening

**AI Image Prompt Example**:
```
"Professional tennis court in winter with light snow, warm holiday string lights around the edges, evening lighting, festive but elegant, realistic, high quality, 16:9 aspect ratio"
```

#### January - New Year Theme
**Filename**: `tennis-court-newyear.jpg`
- Tennis court with fresh, clean aesthetic
- Bright, clear winter day lighting
- Optional: Subtle sparkle or celebratory elements
- Focus: Fresh start, new beginnings feel
- Mood: Energetic, fresh, optimistic

**AI Image Prompt Example**:
```
"Professional tennis court on a bright clear winter morning, clean fresh aesthetic, subtle sparkle effects, optimistic lighting, realistic, high quality, 16:9 aspect ratio"
```

#### February - Late Winter Theme
**Filename**: `tennis-court-latewinter.jpg`
- Tennis court in late winter/early spring transition
- Lighter winter elements, hints of approaching spring
- Clear, bright lighting
- Focus: Transition from winter to spring
- Mood: Anticipation, lighter feel

**AI Image Prompt Example**:
```
"Professional tennis court in late winter, hints of early spring, bright natural lighting, clean and fresh, realistic, high quality, 16:9 aspect ratio"
```

## Implementation Steps

### Step 1: Create or Source Images
You can either:
1. **AI Generation**: Use AI image generators (DALL-E, Midjourney, Stable Diffusion) with the prompts above
2. **Stock Photography**: Find and customize from stock photo sites (Unsplash, Pexels, Shutterstock)
3. **Custom Photography**: Take photos of a local tennis court and edit with seasonal effects
4. **Photo Editing**: Take the existing `tennis-court.jpg` and apply seasonal color grading/effects

### Step 2: Optimize Images
Before adding to the project, optimize images:
```bash
# Using ImageMagick (if installed)
magick convert tennis-court-autumn.jpg -quality 85 -resize 1920x1080 -strip tennis-court-autumn.jpg

# Or use online tools like:
# - TinyPNG (https://tinypng.com/)
# - Squoosh (https://squoosh.app/)
# - ImageOptim (Mac)
```

### Step 3: Add Images to Project
1. Place optimized images in `src/assets/` directory:
   - `src/assets/tennis-court-autumn.jpg`
   - `src/assets/tennis-court-winter.jpg`
   - `src/assets/tennis-court-newyear.jpg`
   - `src/assets/tennis-court-latewinter.jpg`

2. Update `src/utils/seasonalTheme.js` to import the new images:
```javascript
// Uncomment and update these import lines:
import tennisCourtAutumn from '../assets/tennis-court-autumn.jpg';
import tennisCourtWinter from '../assets/tennis-court-winter.jpg';
import tennisCourtNewYear from '../assets/tennis-court-newyear.jpg';
import tennisCourtLateWinter from '../assets/tennis-court-latewinter.jpg';

// Then update the return statements to use the imported images:
// November theme
return {
  name: 'autumn',
  image: tennisCourtAutumn, // Changed from tennisCourtDefault
  gradient: 'linear-gradient(to right, rgba(194, 65, 12, 0.85), rgba(120, 53, 15, 0.85))',
  description: 'Autumn/Thanksgiving Theme'
};
```

3. Rebuild the application:
```bash
npm run build
```

## Testing Seasonal Themes

### Test in Development
To test different seasonal themes without waiting for actual date changes:

1. Temporarily modify `src/utils/seasonalTheme.js`:
```javascript
export const getSeasonalTheme = (currentDate = new Date()) => {
  // TESTING: Uncomment one of these to force a specific theme
  // const month = 10; // Force November (Autumn)
  // const month = 11; // Force December (Winter)
  // const month = 0;  // Force January (New Year)
  // const month = 1;  // Force February (Late Winter)

  const month = currentDate.getMonth(); // Normal operation
  const day = currentDate.getDate();
  // ... rest of function
}
```

2. View changes in browser
3. Remember to remove test code before committing

### Verify Auto-Switching
- Current theme loads automatically based on system date
- No manual intervention needed
- Theme updates when month changes

## Current Status

✅ **Infrastructure Complete**
- Date-based switching logic implemented
- Seasonal gradients configured
- Text color themes set up
- Seasonal messages added

⏳ **Pending**
- Seasonal images need to be created/sourced and added
- Currently using default image for all themes

## Quick Start Checklist

- [ ] Create/source autumn tennis court image
- [ ] Create/source winter tennis court image
- [ ] Create/source new year tennis court image
- [ ] Create/source late winter tennis court image
- [ ] Optimize all images to 150-200KB
- [ ] Add images to `src/assets/` directory
- [ ] Update import statements in `seasonalTheme.js`
- [ ] Update return statements to use new images
- [ ] Test each theme
- [ ] Rebuild and deploy

## Troubleshooting

### Images not showing
- Check that images are in `src/assets/` directory
- Verify import statements are uncommented
- Check browser console for 404 errors
- Clear browser cache and rebuild

### Wrong theme showing
- Check system date is correct
- Verify logic in `getSeasonalTheme()` function
- Check month calculation (remember: January = 0, February = 1, etc.)

### Performance issues
- Check image file sizes (should be <200KB each)
- Optimize images if needed
- Consider using WebP format with JPG fallback

## Future Enhancements

Possible future additions:
- Animated seasonal effects (CSS particles, snow, leaves)
- Transition animations between themes
- Admin panel to manually override theme
- Multiple image variants per season
- Time-of-day variations (morning/evening)

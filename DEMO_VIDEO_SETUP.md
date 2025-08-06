# Demo Video Setup Guide

## Recording Your Demo Video

### Recommended Recording Tools:
- **OBS Studio** (free, cross-platform)
- **Loom** (web-based, easy to use)
- **ScreenFlow** (Mac)
- **Camtasia** (Windows/Mac)
- **QuickTime Player** (Mac, built-in)

### Video Format Requirements:
- **Format**: MP4
- **Codec**: H.264
- **Resolution**: 1920x1080 or 1280x720
- **Frame Rate**: 30fps
- **Duration**: 1-3 minutes (keep it concise)

### Recording Tips:
1. **Plan your demo**: Write a simple script of what you want to show
2. **Keep it simple**: Focus on 2-3 key features
3. **Smooth movements**: Move your cursor deliberately and slowly
4. **Clear narration**: Speak clearly if including audio
5. **Good lighting**: Ensure your screen is well-lit and readable

### Suggested Demo Flow:
1. **Introduction** (10-15 seconds)
   - Show the main interface
   - Point out key elements

2. **Adding an Event** (30-45 seconds)
   - Click "Add Event" button
   - Select an event type
   - Fill in parameters
   - Show how it appears on the timeline

3. **Managing Envelopes** (30-45 seconds)
   - Open envelope manager
   - Show how to edit envelope settings
   - Demonstrate budget allocation

4. **Navigation** (20-30 seconds)
   - Show how to zoom and pan
   - Demonstrate timeline navigation
   - Point out the visualization features

5. **Conclusion** (10-15 seconds)
   - Show the final result
   - Mention key benefits

### File Setup:
1. Record your video using your preferred tool
2. Export as MP4 with H.264 codec
3. Name the file `demo-video.mp4`
4. Place it in the `public` folder of your project
5. The video will automatically appear in the Help modal

### File Structure:
```
modal-canvas-flow/
├── public/
│   └── demo-video.mp4  ← Place your video here
├── src/
│   └── components/
│       ├── HelpModal.tsx
│       └── VideoPlayer.tsx
```

### Testing:
1. Start your development server
2. Click the hamburger menu → Help
3. Click "Watch Demo Video"
4. Your video should play with custom controls

### Troubleshooting:
- **Video not playing**: Check that the file is in the `public` folder and named correctly
- **Format issues**: Re-export your video as MP4 with H.264 codec
- **File too large**: Compress the video or reduce resolution
- **Browser compatibility**: Test in Chrome, Firefox, and Safari

### Alternative Video Sources:
If you prefer to host the video elsewhere:
1. Upload to YouTube/Vimeo and use the embed URL
2. Use a CDN service
3. Host on your own server

Just update the `src` attribute in `HelpModal.tsx`:
```tsx
<VideoPlayer
  src="https://your-video-url.com/demo-video.mp4"
  title="How to use the application"
  className="w-full aspect-video"
/>
``` 
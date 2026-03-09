# SpeakApp Native PoC

Standalone iOS proof of concept for a native shell of SpeakApp.

What is included:
- Native `UITabBarController` with tabs `Training`, `Lab`, `Reference`, `You`, and `Chat`
- Native title bar with reused branding asset
- Notifications sheet from the bell button
- Diagnostics sheet on double tap over the title view
- Bilingual `AppCopy.json` (`en` and `es`) with the app currently booting in `en`
- Mock signed-in user: `user@domain.com`

How to open:

```bash
open "SpeakApp native/SpeakAppNative.xcodeproj"
```

How to build from CLI:

```bash
xcodebuild -project "SpeakApp native/SpeakAppNative.xcodeproj" -scheme SpeakAppNative -destination "generic/platform=iOS Simulator" build
```

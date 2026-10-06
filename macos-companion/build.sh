#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "🔨 Building Recall Flow native macOS companion..."
swiftc -O RecallFlowCompanion.swift -o recall-flow-mac

echo "🔨 Building Recall native Apple EventKit/UserNotifications bridge..."
swiftc -O RecallAppleBridge.swift -o recall-apple-bridge

echo "📦 Packaging Recall Flow.app bundle with macOS permissions and icon..."
mkdir -p "Recall Flow.app/Contents/MacOS"
mkdir -p "Recall Flow.app/Contents/Resources"
cp ../public/recall-logo.png "Recall Flow.app/Contents/Resources/recall-logo.png"

# Generate high-resolution macOS .icns from public/recall-logo.png
if [ -f "../public/recall-logo.png" ]; then
    rm -rf AppIcon.iconset
    mkdir -p AppIcon.iconset
    sips -z 16 16     ../public/recall-logo.png --out AppIcon.iconset/icon_16x16.png > /dev/null 2>&1 || true
    sips -z 32 32     ../public/recall-logo.png --out AppIcon.iconset/icon_16x16@2x.png > /dev/null 2>&1 || true
    sips -z 32 32     ../public/recall-logo.png --out AppIcon.iconset/icon_32x32.png > /dev/null 2>&1 || true
    sips -z 64 64     ../public/recall-logo.png --out AppIcon.iconset/icon_32x32@2x.png > /dev/null 2>&1 || true
    sips -z 128 128   ../public/recall-logo.png --out AppIcon.iconset/icon_128x128.png > /dev/null 2>&1 || true
    sips -z 256 256   ../public/recall-logo.png --out AppIcon.iconset/icon_128x128@2x.png > /dev/null 2>&1 || true
    sips -z 256 256   ../public/recall-logo.png --out AppIcon.iconset/icon_256x256.png > /dev/null 2>&1 || true
    sips -z 512 512   ../public/recall-logo.png --out AppIcon.iconset/icon_256x256@2x.png > /dev/null 2>&1 || true
    sips -z 512 512   ../public/recall-logo.png --out AppIcon.iconset/icon_512x512.png > /dev/null 2>&1 || true
    sips -z 1024 1024 ../public/recall-logo.png --out AppIcon.iconset/icon_512x512@2x.png > /dev/null 2>&1 || true
    iconutil -c icns AppIcon.iconset -o "Recall Flow.app/Contents/Resources/AppIcon.icns" > /dev/null 2>&1 || true
    rm -rf AppIcon.iconset
fi

cat << 'EOF' > "Recall Flow.app/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>recall-flow-mac</string>
    <key>CFBundleIdentifier</key>
    <string>com.recall.flow</string>
    <key>CFBundleName</key>
    <string>Recall Flow</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSMicrophoneUsageDescription</key>
    <string>Recall Flow needs microphone access to listen to your voice.</string>
    <key>NSSpeechRecognitionUsageDescription</key>
    <string>Recall Flow uses speech recognition to convert your speech to text.</string>
    <key>NSAppleEventsUsageDescription</key>
    <string>Recall Flow uses Apple Events to type text into your active applications.</string>
    <key>NSCalendarsUsageDescription</key>
    <string>Recall uses Apple Calendar to schedule meetings and check your availability.</string>
    <key>NSRemindersUsageDescription</key>
    <string>Recall uses Apple Reminders to sync tasks across your Apple devices via iCloud.</string>
</dict>
</plist>
EOF

cp recall-flow-mac "Recall Flow.app/Contents/MacOS/recall-flow-mac"
cp recall-apple-bridge "Recall Flow.app/Contents/MacOS/recall-apple-bridge"
codesign --force --deep --sign - "Recall Flow.app"

echo "✅ Successfully built: $DIR/Recall Flow.app"

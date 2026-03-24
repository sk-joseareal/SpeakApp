

r34lp0w3r@m1MBP SpeakApp % xcrun xctrace list devices
== Devices ==
m1MBP (26321B72-EAE7-58EE-AE58-8249966BE198)
1p4dPr0M4 (26.3.1) (00008132-000905E81185001C)
1ph0n3-11-pr0M4x (26.3) (00008030-000210123450802E)
José Antonio’s Apple Watch (26.3) (00008310-001E70641445A01E)

== Devices Offline ==
1ph0n3-41r (26.3.1) (00008150-001642560C20401C)
1ph0n3XR (18.7.2) (00008020-00122C503EF8002E)


----- 1ph0n3-11-pr0M4x

DEVICE_ID=00008030-000210123450802E TEAM_ID=T4LYZV6KKS DERIVED="$PWD/.build/SpeakAppNativeDevice" && xcodebuild -project "SpeakApp native/SpeakAppNative.xcodeproj" -scheme SpeakAppNative -configuration Debug -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$TEAM_ID" -allowProvisioningUpdates build && xcrun devicectl device install app --device "$DEVICE_ID" "$DERIVED/Build/Products/Debug-iphoneos/SpeakAppNative.app" && xcrun devicectl device process launch --device "$DEVICE_ID" --terminate-existing com.cursoingles.speakapp.nativepoc

DEVICE_ID=00008030-000210123450802E
DERIVED="$PWD/SpeakApp native/.build/SpeakAppNativeDevice"

xcrun devicectl device install app --device "$DEVICE_ID" "$DERIVED/Build/Products/Debug-iphoneos/SpeakAppNative.app"

xcrun devicectl device process launch --device "$DEVICE_ID" --terminate-existing com.cursoingles.speakapp.nativepoc

------ Clean build and install again ------
DEVICE_ID=00008030-000210123450802E
TEAM_ID=T4LYZV6KKS
DERIVED="$PWD/SpeakApp native/.build/SpeakAppNativeDevice"

xcodebuild -project "SpeakApp native/SpeakAppNative.xcodeproj" -scheme SpeakAppNative -configuration Debug -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$TEAM_ID" -allowProvisioningUpdates clean build

xcrun devicectl device install app --device "$DEVICE_ID" "$DERIVED/Build/Products/Debug-iphoneos/SpeakAppNative.app"

xcrun devicectl device process launch --device "$DEVICE_ID" --terminate-existing com.cursoingles.speakapp.nativepoc


----------

DEVICE_ID=00008030-000210123450802E
TEAM_ID=T4LYZV6KKS
DERIVED="$PWD/SpeakApp native/.build/SpeakAppNativeDevice"

xcodebuild -project "SpeakApp native/SpeakAppNative.xcodeproj" -scheme SpeakAppNative -configuration Debug -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$TEAM_ID" -allowProvisioningUpdates clean build

xcrun devicectl device install app --device "$DEVICE_ID" "$DERIVED/Build/Products/Debug-iphoneos/SpeakAppNative.app"

xcrun devicectl device process launch --device "$DEVICE_ID" --terminate-existing com.cursoingles.speakapp.nativepoc



------ 1ph0n3-41r -------

DEVICE_ID=00008150-001642560C20401C
TEAM_ID=T4LYZV6KKS
DERIVED="$PWD/SpeakApp native/.build/SpeakAppNativeDevice"

xcodebuild -project "SpeakApp native/SpeakAppNative.xcodeproj" -scheme SpeakAppNative -configuration Debug -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$TEAM_ID" -allowProvisioningUpdates clean build

xcrun devicectl device install app --device "$DEVICE_ID" "$DERIVED/Build/Products/Debug-iphoneos/SpeakAppNative.app"

xcrun devicectl device process launch --device "$DEVICE_ID" --terminate-existing com.cursoingles.speakapp.nativepoc


------ m1MBP -------

DEVICE_ID=26321B72-EAE7-58EE-AE58-8249966BE198
TEAM_ID=T4LYZV6KKS
DERIVED="$PWD/SpeakApp native/.build/SpeakAppNativeDevice"

xcodebuild -project "SpeakApp native/SpeakAppNative.xcodeproj" -scheme SpeakAppNative -configuration Debug -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$TEAM_ID" -allowProvisioningUpdates clean build

xcrun devicectl device install app --device "$DEVICE_ID" "$DERIVED/Build/Products/Debug-iphoneos/SpeakAppNative.app"

xcrun devicectl device process launch --device "$DEVICE_ID" --terminate-existing com.cursoingles.speakapp.nativepoc


------ m1MBP -------

DEVICE_ID=00008132-000905E81185001C
TEAM_ID=T4LYZV6KKS
DERIVED="$PWD/SpeakApp native/.build/SpeakAppNativeDevice"

xcodebuild -project "SpeakApp native/SpeakAppNative.xcodeproj" -scheme SpeakAppNative -configuration Debug -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$TEAM_ID" -allowProvisioningUpdates clean build

xcrun devicectl device install app --device "$DEVICE_ID" "$DERIVED/Build/Products/Debug-iphoneos/SpeakAppNative.app"

xcrun devicectl device process launch --device "$DEVICE_ID" --terminate-existing com.cursoingles.speakapp.nativepoc



------ 1p4dPr0M4

DEVICE_ID=00008132-000905E81185001C
TEAM_ID=T4LYZV6KKS
DERIVED="$PWD/SpeakApp native/.build/SpeakAppNativeDevice"

xcodebuild -project "SpeakApp native/SpeakAppNative.xcodeproj" -scheme SpeakAppNative -configuration Debug -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$TEAM_ID" -allowProvisioningUpdates clean build

xcrun devicectl device install app --device "$DEVICE_ID" "$DERIVED/Build/Products/Debug-iphoneos/SpeakAppNative.app"

xcrun devicectl device process launch --device "$DEVICE_ID" --terminate-existing com.cursoingles.speakapp.nativepoc


-----


open "SpeakApp native/SpeakAppNative.xcodeproj"

------

Usuarios conectados:

source ./realtime/.env
curl -sS https://realtime.curso-ingles.com/realtime/community/public/presence \
  -H "x-rt-token: $REALTIME_STATE_TOKEN" | jq




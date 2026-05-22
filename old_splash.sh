#!/bin/bash

# Directorios
mkdir -p /Users/r34lp0w3r/Dev/sokinternet/speakapp/android/app/src/main/res/drawable-mdpi
mkdir -p /Users/r34lp0w3r/Dev/sokinternet/speakapp/android/app/src/main/res/drawable-hdpi
mkdir -p /Users/r34lp0w3r/Dev/sokinternet/speakapp/android/app/src/main/res/drawable-xhdpi
mkdir -p /Users/r34lp0w3r/Dev/sokinternet/speakapp/android/app/src/main/res/drawable-xxhdpi
mkdir -p /Users/r34lp0w3r/Dev/sokinternet/speakapp/android/app/src/main/res/drawable-xxxhdpi

SRC="/Users/r34lp0w3r/Dev/sokinternet/speakapp/www/assets/onboarding/nena-v5.png"
BASE="/Users/r34lp0w3r/Dev/sokinternet/speakapp/android/app/src/main/res"

sips -z 96  96  "$SRC" --out "$BASE/drawable-mdpi/splash_icon.png"
sips -z 144 144 "$SRC" --out "$BASE/drawable-hdpi/splash_icon.png"
sips -z 192 192 "$SRC" --out "$BASE/drawable-xhdpi/splash_icon.png"
sips -z 288 288 "$SRC" --out "$BASE/drawable-xxhdpi/splash_icon.png"
sips -z 384 384 "$SRC" --out "$BASE/drawable-xxxhdpi/splash_icon.png"  
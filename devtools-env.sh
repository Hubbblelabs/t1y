# T1D Prajana Yandra — dev toolchain environment
#
# Every SDK, cache, and dependency store used to build this repo lives on the
# external Crucial SSD (this repo's own volume), not on the internal disk —
# so a fresh clone of this drive to another Mac (with Xcode + JDK already
# present) needs no re-download except platform tools already pinned here.
#
# Usage: `source devtools-env.sh` in any new terminal before running
# `flutter`, `dart`, `pod`, or Android/Gradle commands in app/, or npm in api/.

export FLUTTER_ROOT="/Volumes/Crucial/devtools/flutter"
export PATH="$FLUTTER_ROOT/bin:$PATH"
export PUB_CACHE="/Volumes/Crucial/devtools/pub-cache"

export ANDROID_HOME="/Volumes/Crucial/devtools/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
export GRADLE_USER_HOME="/Volumes/Crucial/devtools/gradle-home"

export CP_HOME_DIR="/Volumes/Crucial/devtools/cocoapods-home"
export LANG=en_US.UTF-8

# Xcode itself already lives on this SSD (/Volumes/Crucial/Applications/Xcode.app) —
# no relocation needed there. Confirm with: xcode-select -p

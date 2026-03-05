#!/bin/bash
set -euo pipefail

# Install atom-hydra with webcam support for Pulsar on macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/mroberts1/atom-hydra/master/install-pulsar-hydra.sh | bash

PULSAR_APP="/Applications/Pulsar.app"
PULSAR_PACKAGES="$HOME/.pulsar/packages"
CLONE_DIR="$PULSAR_PACKAGES/atom-hydra"

echo "=== Installing atom-hydra with webcam support for Pulsar ==="

# Check Pulsar is installed
if [ ! -d "$PULSAR_APP" ]; then
  echo "Error: Pulsar not found at $PULSAR_APP"
  exit 1
fi

# Step 1: Clone the patched atom-hydra plugin
echo ""
echo "[1/3] Installing atom-hydra package..."
if [ -d "$CLONE_DIR" ] || [ -L "$CLONE_DIR" ]; then
  echo "  Removing existing atom-hydra installation..."
  rm -rf "$CLONE_DIR"
fi
mkdir -p "$PULSAR_PACKAGES"
git clone https://github.com/mroberts1/atom-hydra.git "$CLONE_DIR"
cd "$CLONE_DIR" && npm install
echo "  ✓ atom-hydra installed"

# Step 2: Add camera entitlement to Pulsar
echo ""
echo "[2/3] Adding camera entitlement to Pulsar..."
echo "  Pulsar ships with hardened runtime but no camera entitlement."
echo "  Re-signing with camera access (ad-hoc signature)..."

ENTITLEMENTS=$(mktemp /tmp/pulsar-entitlements.XXXXXX.plist)
cat > "$ENTITLEMENTS" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
</dict>
</plist>
EOF

codesign --force --deep --sign - --entitlements "$ENTITLEMENTS" "$PULSAR_APP"
rm "$ENTITLEMENTS"
echo "  ✓ Pulsar re-signed with camera entitlement"

# Step 3: Done
echo ""
echo "[3/3] Done!"
echo ""
echo "To use:"
echo "  1. Open (or restart) Pulsar"
echo "  2. Toggle hydra: Ctrl+Shift+H (or Packages > atom-hydra > Toggle)"
echo "  3. Initialize webcam: s0.initCam(0)"
echo "  4. Display it: src(s0).out()"
echo ""
echo "  macOS will prompt for camera permission on first use — grant it."

#!/bin/bash
set -eu
export DISPLAY=:99
export GTK_MODULES=atk-bridge
export GSETTINGS_BACKEND=memory
printf '%s' "$DBUS_SESSION_BUS_ADDRESS" >/results/session-bus.txt
mkdir -p /results/speech
Xvfb :99 -screen 0 1280x1000x24 -nolisten tcp >/results/xvfb.log 2>&1 &
for attempt in $(seq 1 30); do xdpyinfo -display :99 >/dev/null 2>&1 && break; sleep 0.1; done
openbox >/results/openbox.log 2>&1 &
socat TCP4-LISTEN:18000,bind=127.0.0.1,reuseaddr,fork TCP4:supabase_kong_global-opportunity-os-s1-validation:8000 >/results/provider-forward.log 2>&1 &
socat TCP4-LISTEN:9223,bind=0.0.0.0,reuseaddr,fork TCP4:127.0.0.1:9222 >/results/cdp-forward.log 2>&1 &
pulseaudio --start --exit-idle-time=-1 >/results/pulse.log 2>&1
pactl load-module module-null-sink sink_name=goos_a11y >/results/audio-sink.txt
pactl set-default-sink goos_a11y
parec --device=goos_a11y.monitor --file-format=wav /results/orca-speech.wav >/results/audio.log 2>&1 &
echo "$!" >/results/audio.pid
printf 'Starting assistive technology session\n' >/results/startup.log
gdbus call --session --dest org.a11y.Bus --object-path /org/a11y/bus --method org.freedesktop.DBus.Properties.Set org.a11y.Status IsEnabled '<true>' >/results/atspi-enable.log 2>&1
gdbus call --session --dest org.a11y.Bus --object-path /org/a11y/bus --method org.freedesktop.DBus.Properties.Set org.a11y.Status ScreenReaderEnabled '<true>' >>/results/atspi-enable.log 2>&1
speech-dispatcher -d >/results/speech-dispatcher.log 2>&1 || true
orca --replace --no-setup --disable=main-window --debug-file=/results/orca.log >/results/orca-start.log 2>&1 &
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100 >/results/app.log 2>&1 &
exec chromium --no-sandbox --disable-dev-shm-usage --disable-gpu --force-renderer-accessibility \
  --remote-debugging-port=9222 --user-data-dir=/tmp/goos-chromium about:blank >/results/chromium.log 2>&1

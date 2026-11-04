# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim
RUN --mount=type=secret,id=ca_bundle,required=true \
    apt-get -o Acquire::https::CaInfo=/run/secrets/ca_bundle update && \
    apt-get -o Acquire::https::CaInfo=/run/secrets/ca_bundle install -y --no-install-recommends \
      chromium orca xvfb dbus-x11 at-spi2-core gsettings-desktop-schemas xauth \
      espeak-ng speech-dispatcher speech-dispatcher-espeak-ng pulseaudio pulseaudio-utils \
      socat tini fonts-noto-core fonts-noto-color-emoji libnss3-tools ca-certificates && \
    rm -rf /var/lib/apt/lists/*
RUN --mount=type=secret,id=ca_bundle,required=true \
    apt-get -o Acquire::https::CaInfo=/run/secrets/ca_bundle update && \
    apt-get -o Acquire::https::CaInfo=/run/secrets/ca_bundle install -y --no-install-recommends openbox xdotool libglib2.0-bin && \
    rm -rf /var/lib/apt/lists/*
COPY start.sh /opt/goos-a11y/start.sh
RUN chmod 755 /opt/goos-a11y/start.sh
WORKDIR /app
ENTRYPOINT ["/usr/bin/tini","-g","--","dbus-run-session","--","/opt/goos-a11y/start.sh"]

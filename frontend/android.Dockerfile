# Java and the Android SDK, so that the APK can be built without installing either on the computer.
FROM eclipse-temurin:21-jdk

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN apt-get update && apt-get install -y --no-install-recommends unzip curl && rm -rf /var/lib/apt/lists/*
RUN mkdir -p $ANDROID_HOME/cmdline-tools \
    && curl -fsSL -o /tmp/tools.zip https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip \
    && unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools \
    && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
    && rm /tmp/tools.zip
RUN yes | sdkmanager --licenses > /dev/null \
    && sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" > /dev/null
RUN chmod -R a+rwX $ANDROID_HOME

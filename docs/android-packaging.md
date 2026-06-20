# Android 打包说明

当前阶段采用 Web 原型 + Capacitor 的 Android MVP 路线。

## 当前状态

- 已生成 Capacitor 配置：`capacitor.config.json`。
- 已生成 Android 工程：`android/`。
- App 名称：元音花园。
- App ID：`com.vowelgarden.app`。
- Web 输出目录：`www/`。

## 常用命令

```powershell
npm run build:web
npm run android:sync
npm run android:open
```

## D 盘安装要求

Android Studio 和 Android SDK 不要安装到 C 盘。

推荐目录：

```text
D:\Program Files\Android\Android Studio
D:\Program Files\Android\Sdk
```

当前 Android Studio 已解包安装到：

```text
D:\Program Files\Android\Android Studio
```

安装器缓存保留在：

```text
D:\Installers\android-studio-quail1-windows.exe
```

当前 Android SDK 已安装到：

```text
D:\Program Files\Android\Sdk
```

已安装的核心组件：

- `platform-tools`
- `platforms;android-35`
- `platforms;android-36`
- `build-tools;35.0.0`
- `emulator`
- `cmdline-tools;latest`

Android 工程已配置：

```text
vowel-garden/android/local.properties
sdk.dir=D:/Program Files/Android/Sdk
```

当前 debug APK 已成功构建：

```text
vowel-garden/android/app/build/outputs/apk/debug/app-debug.apk
```

构建命令：

```powershell
$env:JAVA_HOME='D:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='D:\Program Files\Android\Sdk'
$env:ANDROID_SDK_ROOT='D:\Program Files\Android\Sdk'
cd F:\DEV-WORKER-DIR\windows_server\vowel-garden\android
.\gradlew.bat assembleDebug
```

## 设备兼容策略

- 最低支持 Android 7.0+：`minSdkVersion = 24`。
- 当前目标 SDK：`targetSdkVersion = 36`。
- 当前编译 SDK：`compileSdkVersion = 36`。
- APK 不应限制为仅 x86。当前 debug APK 未声明 `native-code`，因此不会因 ABI 限制挡住 ARM 设备。
- Windows 模拟器使用 x86_64 系统镜像只是为了本机运行速度；真机发布仍要以 ARM Android 设备为主要验收目标。

当前 Windows 预览模拟器：

```text
VowelGarden_API35
```

模拟器数据目录：

```text
D:\Program Files\Android\Avd
```

如果使用 Android Studio 首次启动向导，选择 Custom 安装，并把 Android SDK Location 指向：

```text
D:\Program Files\Android\Sdk
```

如果使用命令行构建，后续应设置：

```powershell
$env:ANDROID_HOME='D:\Program Files\Android\Sdk'
$env:ANDROID_SDK_ROOT='D:\Program Files\Android\Sdk'
```

## 仍需补充

- Android app icon
- splash screen
- localStorage 到更稳定存储的迁移策略
- 音频资源路径规范
- 隐私政策与权限说明

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.drift.launcher"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.drift.launcher"
        minSdk = 28          // Shield 2019 (Android 11) and Chromecast GTV (Android 12/14)
        targetSdk = 34
        versionCode = 16
        versionName = "2.2"
    }

    // Release signing key is NOT in this public repo. Supply it to build an APK that updates over
    // the published one:  gradle assembleRelease -PdriftKeystore=/path/drift.jks -PdriftKeyPassword=...
    // Without it, builds are signed with the standard debug key (fine for trying it out).
    val keystore = (findProperty("driftKeystore") as String?)?.let { file(it) }
    val keyPassword = findProperty("driftKeyPassword") as String?
    if (keystore != null && keystore.exists() && keyPassword != null) {
        signingConfigs {
            create("sideload") {
                storeFile = keystore
                storePassword = keyPassword
                keyAlias = "drift"
                this.keyPassword = keyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.findByName("sideload") ?: signingConfigs.getByName("debug")
        }
        debug { signingConfigs.findByName("sideload")?.let { signingConfig = it } }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    packaging { resources.excludes += "**/*.kotlin_builtins" }
}

// NewApi is an error: the Shield 2019 runs Android 11 (API 30), so nothing newer may be called unguarded.
android.lint {
    error += "NewApi"
    checkReleaseBuilds = true
    abortOnError = true
    checkOnly += setOf("NewApi", "InlinedApi")
}

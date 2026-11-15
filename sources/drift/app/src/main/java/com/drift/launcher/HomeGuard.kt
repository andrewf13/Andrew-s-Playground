package com.drift.launcher

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.provider.Settings
import android.app.Notification
import android.media.session.MediaSession
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent

/**
 * The no-ADB way to make the Home button open Drift.
 *
 * Google TV and the Shield send Home to their own launcher, and only ADB or root can switch that
 * off. This accessibility service watches for one thing only: the stock home screen coming to the
 * front. When it does, Drift is brought straight back. The service is limited to those launcher
 * packages (see res/xml/home_guard.xml), reads no screen content and sees no other app.
 */
class HomeGuard : AccessibilityService() {

    private var last = 0L

    override fun onAccessibilityEvent(e: AccessibilityEvent) {
        val pkg = e.packageName?.toString() ?: return
        if (e.eventType == AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED) { mediaToken(pkg, e); return }
        if (e.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        if (pkg !in STOCK_LAUNCHERS) return
        val now = SystemClock.uptimeMillis()
        if (now - last < 700) return
        last = now
        runCatching {
            startActivity(Intent(this, MainActivity::class.java)
                .setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION))
        }
    }

    /**
     * Now playing without notification access (the Shield has no screen to grant it): a media
     * notification carries its player's MediaSession token, the same thing Android's own media
     * controls use. Keep only that token; every other notification is ignored and nothing from it
     * is read or kept.
     */
    @Suppress("DEPRECATION")
    private fun mediaToken(pkg: String, e: AccessibilityEvent) {
        val n = e.parcelableData as? Notification ?: return
        val token = runCatching { n.extras.getParcelable<MediaSession.Token>(Notification.EXTRA_MEDIA_SESSION) }.getOrNull() ?: return
        MediaTokens.put(pkg, token)
    }

    override fun onInterrupt() {}

    companion object {
        val STOCK_LAUNCHERS = setOf(
            "com.google.android.apps.tv.launcherx",   // Google TV (Chromecast)
            "com.google.android.tvlauncher",          // Android TV home (Shield)
            "com.google.android.leanbacklauncher",    // older Android TV home
        )

        fun isOn(ctx: Context): Boolean {
            val me = ComponentName(ctx, HomeGuard::class.java)
            return Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
                ?.split(':')?.any { ComponentName.unflattenFromString(it) == me } == true
        }
    }
}

/** Media session tokens handed over by [HomeGuard]; [NowPlaying] builds controllers from them. */
object MediaTokens {
    private val main = Handler(Looper.getMainLooper())
    val tokens = LinkedHashMap<String, MediaSession.Token>()
    var listener: (() -> Unit)? = null

    fun put(pkg: String, token: MediaSession.Token) = main.post {
        if (tokens[pkg] != token) { tokens[pkg] = token; listener?.invoke() }
    }
}

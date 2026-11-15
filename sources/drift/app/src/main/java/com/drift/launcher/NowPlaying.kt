package com.drift.launcher

import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.service.notification.NotificationListenerService
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Exists only so Android will hand us the list of active media sessions. Grant once with:
 *   adb shell cmd notification allow_listener com.drift.launcher/com.drift.launcher.MediaListener
 */
class MediaListener : NotificationListenerService()

class Track(val title: String, val artist: String, val album: String, val art: Bitmap?, val pkg: String, val playing: Boolean) {
    /** "Artist • Album", like Qobuz's own player. */
    val subtitle get() = listOf(artist, album).filter { it.isNotBlank() }.joinToString("  •  ")
}

/** Watches media sessions (Qobuz and friends) and reports what is playing right now. */
class NowPlaying(private val ctx: Context, private val onChange: (Track?) -> Unit) {

    companion object {
        const val QOBUZ_PREFIX = "com.qobuz"
        const val GRANT = "adb shell cmd notification allow_listener com.drift.launcher/com.drift.launcher.MediaListener"

        /** Now playing can work: notification access, or the Home button helper (media tokens). */
        fun canShow(ctx: Context): Boolean = hasAccess(ctx) || HomeGuard.isOn(ctx)

        fun hasAccess(ctx: Context): Boolean =
            Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners")
                ?.split(':')?.any { ComponentName.unflattenFromString(it)?.packageName == ctx.packageName } == true
    }

    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private val msm = ctx.getSystemService(MediaSessionManager::class.java)
    private val cn = ComponentName(ctx, MediaListener::class.java)
    private var controllers: List<MediaController> = emptyList()
    private var qobuzOnly = false
    private var running = false
    private var lastKey: String? = null
    private val artCache = HashMap<String, Bitmap?>()

    private val sessions = MediaSessionManager.OnActiveSessionsChangedListener { list -> attach(list.orEmpty()) }
    private val callback = object : MediaController.Callback() {
        override fun onPlaybackStateChanged(state: PlaybackState?) = publish()
        override fun onMetadataChanged(metadata: MediaMetadata?) = publish()
        override fun onSessionDestroyed() = publish()
    }

    /** @return false when Drift hasn't been granted access yet. */
    fun start(qobuzOnly: Boolean): Boolean {
        this.qobuzOnly = qobuzOnly
        if (running) { publish(); return true }
        return try {
            msm.addOnActiveSessionsChangedListener(sessions, cn, main)
            attach(msm.getActiveSessions(cn))
            running = true
            tokenMode = false
            true
        } catch (e: SecurityException) {
            // No notification access (e.g. the Shield has no screen to grant it): use the player
            // tokens the Home button helper picks up from media notifications instead.
            if (!HomeGuard.isOn(ctx)) return false
            MediaTokens.listener = { attach(fromTokens()) }
            attach(fromTokens())
            running = true
            tokenMode = true
            true
        }
    }

    private var tokenMode = false

    private fun fromTokens(): List<MediaController> =
        MediaTokens.tokens.values.mapNotNull { runCatching { MediaController(ctx, it) }.getOrNull() }

    fun stop() {
        if (!running) return
        running = false
        MediaTokens.listener = null
        if (!tokenMode) runCatching { msm.removeOnActiveSessionsChangedListener(sessions) }
        controllers.forEach { runCatching { it.unregisterCallback(callback) } }
        controllers = emptyList()
    }

    private fun attach(list: List<MediaController>) {
        controllers.forEach { runCatching { it.unregisterCallback(callback) } }
        controllers = list
        controllers.forEach { it.registerCallback(callback, main) }
        publish()
    }

    /** The session on screen. */
    var active: MediaController? = null
        private set

    private fun publish() {
        val eligible = controllers.filter { !qobuzOnly || it.packageName.startsWith(QOBUZ_PREFIX) }
        val playing = eligible.filter { it.playbackState?.state == PlaybackState.STATE_PLAYING }
        // Prefer what's playing (Qobuz first). Otherwise keep the last shown session while it's only
        // paused, so it stays on screen (dimmed) through a pause.
        val c = playing.firstOrNull { it.packageName.startsWith(QOBUZ_PREFIX) } ?: playing.firstOrNull()
            ?: active?.let { a -> eligible.firstOrNull { it.sessionToken == a.sessionToken } }
                ?.takeIf { it.playbackState?.state in setOf(PlaybackState.STATE_PAUSED, PlaybackState.STATE_BUFFERING, PlaybackState.STATE_CONNECTING, PlaybackState.STATE_SKIPPING_TO_NEXT, PlaybackState.STATE_SKIPPING_TO_PREVIOUS, PlaybackState.STATE_SKIPPING_TO_QUEUE_ITEM) }
        active = c
        val isPlaying = c?.playbackState?.state != PlaybackState.STATE_PAUSED
        val md = c?.metadata
        val title = md?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: md?.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE)
        if (c == null || md == null || title.isNullOrBlank()) {
            active = null
            if (lastKey != null) { lastKey = null; onChange(null) }
            return
        }
        val artist = listOf(MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_ALBUM_ARTIST, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)
            .firstNotNullOfOrNull { md.getString(it)?.takeIf(String::isNotBlank) }.orEmpty()
        val album = md.getString(MediaMetadata.METADATA_KEY_ALBUM)?.takeIf { it.isNotBlank() && it != title }.orEmpty()
        val bitmap = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
            ?: md.getBitmap(MediaMetadata.METADATA_KEY_ART) ?: md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
        val artUri = listOf(MediaMetadata.METADATA_KEY_ALBUM_ART_URI, MediaMetadata.METADATA_KEY_ART_URI, MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI)
            .firstNotNullOfOrNull { md.getString(it)?.takeIf(String::isNotBlank) }

        val key = "$isPlaying|$title|$artist|$album|${bitmap?.generationId}|$artUri"
        if (key == lastKey) return
        lastKey = key
        val art = bitmap ?: artUri?.let { artCache[it] }
        onChange(Track(title, artist, album, art, c.packageName, isPlaying))
        if (art == null && artUri != null && !artCache.containsKey(artUri)) {
            io.execute {
                val b = runCatching { loadArt(artUri) }.getOrNull()
                main.post {
                    artCache[artUri] = b
                    if (b != null && lastKey == key) onChange(Track(title, artist, album, b, c.packageName, isPlaying))
                }
            }
        }
    }

    private fun loadArt(uri: String): Bitmap? {
        val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
        return if (uri.startsWith("http")) {
            val conn = URL(uri).openConnection() as HttpURLConnection
            conn.connectTimeout = 5000; conn.readTimeout = 8000
            try { conn.inputStream.use { BitmapFactory.decodeStream(it, null, opts) } } finally { conn.disconnect() }
        } else ctx.contentResolver.openInputStream(Uri.parse(uri))?.use { BitmapFactory.decodeStream(it, null, opts) }
    }
}

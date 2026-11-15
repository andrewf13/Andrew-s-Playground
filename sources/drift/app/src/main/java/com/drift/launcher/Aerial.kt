package com.drift.launcher

import android.annotation.SuppressLint
import android.content.Context
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.View
import android.widget.FrameLayout
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.max

class Clip(val label: String, val h264: String?, val sdr1080: String?, val sdr4k: String?) {
    fun url(quality: String): String? =
        (if (quality == "4k") sdr4k ?: sdr1080 ?: h264 else h264 ?: sdr1080 ?: sdr4k)?.let(Aerials::plain)
}

/**
 * The same Apple TV aerial catalogue that Aerial Dream plays.
 *
 * Apple's aerial CDN (sylvan.apple.com) serves a certificate Android does not trust, so - exactly as
 * Aerial Dream does - every Apple URL is fetched over plain http (allowed for those hosts only in
 * network_security.xml).
 *
 * Where the list comes from, first hit wins:
 *  1. videos you copy into Android/data/com.drift.launcher/files/Aerials (no network at all)
 *  2. our cached copy of Apple's manifest (refreshed weekly)
 *  3. the list bundled inside the installed Aerial Dream app (instant, and known to work on this
 *     TV); Apple's live manifest is then fetched in the background for next time
 *  4. Apple's live manifest
 *  5. a few built-in clips
 */
object Aerials {
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private const val WEEK = 7L * 24 * 3600 * 1000
    const val AERIAL_DREAM = "com.codingbuffalo.aerialdream"

    private val manifests = listOf(
        "http://sylvan.apple.com/Aerials/resources-13.tar",   // what Aerial Dream ships: 1080p SDR, small tar
        "http://sylvan.apple.com/Aerials/resources-15.tar",
        "http://sylvan.apple.com/Aerials/resources-16.tar",
        "http://sylvan.apple.com/Aerials/2x/entries.json",
    )

    /** Used only if nothing else can be found. */
    private val fallback = listOf(
        Clip("Greenland", null, "http://sylvan.apple.com/Videos/comp_GL_G004_C010_SDR_20191122_SDR_2K_AVC.mov", null),
        Clip("Dubai", null, "http://sylvan.apple.com/Videos/comp_DB_D008_C010_SDR_20191122_SDR_2K_AVC.mov", null),
        Clip("Hong Kong", null, "http://sylvan.apple.com/Videos/comp_HK_H004_C008_SDR_20191122_SDR_2K_AVC.mov", null),
        Clip("Los Angeles", null, "http://sylvan.apple.com/Videos/comp_LA_A006_C004_SDR_20191122_SDR_2K_AVC.mov", null),
    )

    @Volatile private var clips: List<Clip> = emptyList()
    private var order = ArrayDeque<Clip>()
    @Volatile private var loading = false
    @Volatile private var degradedAt = 0L   // set when we fell back (e.g. booted before the network was up)

    /** One line for the settings sheet, so a failure is visible on the TV. */
    @Volatile var status: String = "Loading…"
        private set
    @Volatile var lastError: String? = null

    fun plain(url: String): String =
        if (url.startsWith("https://") && (url.contains(".apple.com/") || url.contains(".apple.com:"))) "http://" + url.removePrefix("https://") else url

    fun next(): Clip? {
        if (clips.isEmpty()) return null
        if (order.isEmpty()) order = ArrayDeque(clips.shuffled())
        return order.removeFirst()
    }

    fun ensure(ctx: Context, store: Store, done: () -> Unit) {
        val retry = degradedAt != 0L && System.currentTimeMillis() - degradedAt > 60_000
        if (clips.isNotEmpty() && !retry) { done(); return }
        if (loading) { if (clips.isNotEmpty()) done(); return }
        if (clips.isNotEmpty()) done()   // keep playing what we have while we try again
        val hadClips = clips.isNotEmpty()
        loading = true
        val app = ctx.applicationContext
        io.execute {
            var source = "built-in"
            var refreshLater = false
            val local = localClips(app)
            val cached = store.manifest?.let { runCatching { decode(it) }.getOrNull() }.orEmpty()
            val list: List<Clip> = when {
                local.isNotEmpty() -> { source = "your files"; local }
                cached.isNotEmpty() && store.manifestAgeMs < WEEK -> { source = "Apple"; cached }
                else -> {
                    val bundled = fromAerialDream(app)
                    if (bundled.isNotEmpty()) { source = "Aerial Dream's list"; refreshLater = true; bundled }
                    else fetch()?.also { store.manifest = encode(it); source = "Apple" }
                        ?: cached.ifEmpty { null }?.also { source = "Apple (cached)" }
                        ?: fallback.also { source = "built-in" }
                }
            }
            if (refreshLater) fetch()?.let { store.manifest = encode(it) }
            main.post {
                degradedAt = if (list === fallback) System.currentTimeMillis() else 0L
                status = "${list.size} clips · $source"
                clips = list; order.clear(); loading = false
                if (!hadClips) done()
            }
        }
    }

    private fun localClips(ctx: Context): List<Clip> {
        val dir = ctx.getExternalFilesDir("Aerials") ?: return emptyList()
        return dir.listFiles { f -> f.isFile && f.extension.lowercase() in setOf("mov", "mp4", "mkv", "webm", "m4v") }
            ?.map { f -> val uri = Uri.fromFile(f).toString(); Clip(prettyName(f), uri, uri, uri) }
            .orEmpty()
    }

    private fun prettyName(f: File) = f.nameWithoutExtension.replace('_', ' ').replace('-', ' ')

    /** Aerial Dream ships Apple's manifests as raw resources; read them straight out of the installed app. */
    private fun fromAerialDream(ctx: Context): List<Clip> = runCatching {
        val res = ctx.packageManager.getResourcesForApplication(AERIAL_DREAM)
        for (name in listOf("tvos13", "tvos12", "tvos11", "tvos10")) {
            val id = res.getIdentifier(name, "raw", AERIAL_DREAM)
            if (id == 0) continue
            val json = res.openRawResource(id).bufferedReader().use { it.readText() }
            val list = parse(json)
            if (list.isNotEmpty()) return@runCatching list
        }
        emptyList<Clip>()
    }.getOrElse { emptyList() }

    private fun fetch(): List<Clip>? {
        for (url in manifests) {
            val json = runCatching { download(url) }.onFailure { lastError = it.javaClass.simpleName + ": " + it.message }.getOrNull() ?: continue
            val list = runCatching { parse(json) }.getOrNull()
            if (!list.isNullOrEmpty()) return list
        }
        return null
    }

    private fun download(url: String): String? {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 6000; c.readTimeout = 10000
        c.instanceFollowRedirects = true
        try {
            if (c.responseCode != 200) { lastError = "HTTP ${c.responseCode} for $url"; return null }
            return c.inputStream.buffered().use { if (url.endsWith(".json")) it.reader().readText() else findInTar(it, "entries.json") }
        } finally { c.disconnect() }
    }

    /** Minimal streaming tar reader: stops as soon as the wanted file has been read. */
    private fun findInTar(input: InputStream, wanted: String): String? {
        val hdr = ByteArray(512)
        var longName: String? = null
        while (true) {
            if (!readFully(input, hdr)) return null
            if (hdr.all { it.toInt() == 0 }) return null
            val name = longName ?: (cstr(hdr, 345, 155).let { if (it.isEmpty()) "" else "$it/" } + cstr(hdr, 0, 100))
            longName = null
            val size = cstr(hdr, 124, 12).trim().ifEmpty { "0" }.toLong(8)
            val padded = (size + 511) / 512 * 512
            when (hdr[156].toInt().toChar()) {
                'L' -> { val b = ByteArray(size.toInt()); readFully(input, b); skip(input, padded - size); longName = String(b).trimEnd('\u0000') }
                else -> if (name.endsWith(wanted) && !name.substringAfterLast('/').startsWith("._")) {
                    val b = ByteArray(size.toInt()); readFully(input, b); return String(b, Charsets.UTF_8)
                } else skip(input, padded)
            }
        }
    }

    private fun cstr(b: ByteArray, off: Int, len: Int): String {
        var end = off
        while (end < off + len && b[end].toInt() != 0) end++
        return String(b, off, end - off, Charsets.US_ASCII)
    }

    private fun readFully(i: InputStream, b: ByteArray): Boolean {
        var n = 0
        while (n < b.size) { val r = i.read(b, n, b.size - n); if (r < 0) return false; n += r }
        return true
    }

    private fun skip(i: InputStream, count: Long) {
        var left = count
        while (left > 0) {
            val s = i.skip(left)
            if (s <= 0) { if (i.read() < 0) return; left-- } else left -= s
        }
    }

    /** Works for every Apple manifest shape (tvOS 10 to 16): walk the JSON, keep anything with a video URL. */
    private fun parse(json: String): List<Clip> {
        val out = ArrayList<Clip>()
        fun visit(v: Any?) {
            when (v) {
                is JSONArray -> for (i in 0 until v.length()) visit(v.opt(i))
                is JSONObject -> {
                    fun s(k: String) = v.optString(k).takeIf { it.startsWith("http") }
                    val h264 = s("url-1080-H264") ?: s("url")
                    val sdr = s("url-1080-SDR")
                    val k4 = s("url-4K-SDR") ?: s("url-4K-SDR-120FPS")
                    if (h264 != null || sdr != null || k4 != null) {
                        out += Clip(v.optString("accessibilityLabel").ifEmpty { v.optString("name") }.ifEmpty { v.optString("shotID") }, h264, sdr, k4)
                    } else v.keys().forEach { visit(v.opt(it)) }
                }
            }
        }
        visit(if (json.trimStart().startsWith("[")) JSONArray(json) else JSONObject(json))
        return out.distinctBy { it.h264 ?: it.sdr1080 ?: it.sdr4k }
    }

    private fun encode(list: List<Clip>) = JSONArray().apply {
        list.forEach { put(JSONObject().put("l", it.label).put("a", it.h264).put("b", it.sdr1080).put("c", it.sdr4k)) }
    }.toString()

    private fun decode(s: String): List<Clip> {
        val a = JSONArray(s)
        return (0 until a.length()).map {
            val o = a.getJSONObject(it)
            fun g(k: String) = o.optString(k).takeIf { v -> v.isNotEmpty() && v != "null" }
            Clip(o.optString("l"), g("a"), g("b"), g("c"))
        }
    }
}

/**
 * Full-bleed muted aerial video. Uses a SurfaceView (hardware overlay, cheapest path on both the
 * Shield and the Chromecast) and is fully released whenever the launcher is not on screen, so it
 * never competes with SmartTube or Kodi for the decoder.
 */
@SuppressLint("ViewConstructor")
class AerialView(ctx: Context, private val store: Store, private val onCaption: (String) -> Unit) :
    FrameLayout(ctx), SurfaceHolder.Callback {

    private val surface = SurfaceView(ctx)
    private val veil = View(ctx).apply { setBackgroundResource(R.drawable.window_bg) }
    private val main = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null      // on screen
    private var playingClip: Clip? = null
    private var next: MediaPlayer? = null        // pre-buffering the following clip, no surface yet
    private var nextClip: Clip? = null
    private var nextReady = false
    private var hasSurface = false
    private var wanted = false
    private var failures = 0
    private var videoW = 0
    private var videoH = 0

    /** Start buffering the next clip this long before the current one ends. */
    private val prefetchLeadMs = 45_000
    private val prefetch = Runnable { prepareNext() }

    init {
        addView(surface, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT, Gravity.CENTER))
        addView(veil, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        surface.holder.addCallback(this)
    }

    fun start() {
        wanted = true
        if (store.background == "plain") { stopPlayer(); veil.alpha = 1f; onCaption(""); return }
        Aerials.ensure(context, store) { if (wanted && player == null) play() }
    }

    fun stop() { wanted = false; stopPlayer() }

    fun skip() {
        if (!wanted || store.background == "plain") return
        advance(350)
    }

    /** Cold start: nothing buffered yet, so stream the first clip straight onto the surface. */
    private fun play() {
        if (!wanted || !hasSurface || player != null || store.background == "plain") return
        val clip = Aerials.next() ?: return
        val url = clip.url(store.quality) ?: return
        val mp = MediaPlayer()
        player = mp
        playingClip = clip
        try {
            mp.setDisplay(surface.holder)
            load(mp, url)
        } catch (e: Exception) {
            failed(mp, e.javaClass.simpleName + ": " + e.message)
        }
    }

    /** Shared wiring. Every callback checks which player it came from: the visible one or the one buffering. */
    private fun load(mp: MediaPlayer, url: String) {
        mp.setVolume(0f, 0f)
        mp.setScreenOnWhilePlaying(false)
        mp.setOnVideoSizeChangedListener { p, w, h -> if (p === player) { videoW = w; videoH = h; fit() } }
        mp.setOnPreparedListener { p -> if (p === player) p.start() else if (p === next) nextReady = true }
        mp.setOnInfoListener { p, what, _ ->
            if (p === player && what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) rendering(p)
            false
        }
        mp.setOnCompletionListener { p -> if (p === player) advance(450) }
        mp.setOnErrorListener { p, what, extra -> failed(p, "Playback error $what/$extra on ${Uri.parse(url).host}"); true }
        mp.setDataSource(context, Uri.parse(url))
        mp.prepareAsync()
    }

    private fun rendering(p: MediaPlayer) {
        failures = 0
        veil.animate().cancel()
        veil.animate().alpha(0f).setDuration(1100).start()
        onCaption(playingClip?.label.orEmpty())
        main.removeCallbacks(prefetch)
        if (store.background == "still") {
            // "Still": hold one real aerial frame - no decoding, no bandwidth after this.
            main.postDelayed({ runCatching { if (player === p) p.pause() } }, 1500)
        } else {
            val d = runCatching { p.duration }.getOrDefault(-1)
            main.postDelayed(prefetch, if (d > 0) (d - prefetchLeadMs).coerceAtLeast(0).toLong() else 20_000L)
        }
    }

    /** Open the next clip without a surface; MediaPlayer reads the header and keeps filling its cache. */
    private fun prepareNext() {
        if (!wanted || next != null || store.background != "aerial") return
        val clip = Aerials.next() ?: return
        val url = clip.url(store.quality) ?: return
        val mp = MediaPlayer()
        next = mp; nextClip = clip; nextReady = false
        try { load(mp, url) } catch (e: Exception) { failed(mp, e.javaClass.simpleName + ": " + e.message) }
    }

    /** Short dip to dusk over the last frame, then hand the surface to the buffered player. */
    private fun advance(fadeMs: Long) {
        veil.animate().cancel()
        veil.animate().alpha(1f).setDuration(fadeMs).withEndAction { swap() }.start()
    }

    private fun swap() {
        main.removeCallbacks(prefetch)
        player?.let { runCatching { it.reset() }; runCatching { it.release() } }
        player = null
        val n = next ?: run { play(); return }
        next = null
        player = n
        playingClip = nextClip
        nextClip = null
        try {
            n.setDisplay(surface.holder)
            if (n.videoWidth > 0) { videoW = n.videoWidth; videoH = n.videoHeight; fit() }
            if (nextReady) n.start()   // otherwise onPrepared starts it, now that it's the visible player
        } catch (e: Exception) {
            failed(n, e.javaClass.simpleName + ": " + e.message)
        }
    }

    private fun failed(p: MediaPlayer, why: String) {
        Aerials.lastError = why
        if (p === next) {            // a failed pre-buffer just means the next clip streams cold
            runCatching { p.release() }
            next = null; nextClip = null; nextReady = false
            return
        }
        stopPlayer()
        if (++failures < 6) main.postDelayed({ play() }, 800L * failures)
    }

    private fun stopPlayer() {
        main.removeCallbacksAndMessages(null)
        listOf(player, next).forEach { p -> p?.let { runCatching { it.reset() }; runCatching { it.release() } } }
        player = null; next = null; nextClip = null; nextReady = false
        veil.animate().cancel()
        veil.alpha = 1f
    }

    /** Centre-crop: scale the surface so the video fills the screen with no letterbox. */
    private fun fit() {
        if (videoW == 0 || videoH == 0 || width == 0 || height == 0) return
        val s = max(width.toFloat() / videoW, height.toFloat() / videoH)
        val lp = surface.layoutParams as LayoutParams
        val w = (videoW * s).toInt() + 2
        val h = (videoH * s).toInt() + 2
        if (lp.width != w || lp.height != h) { lp.width = w; lp.height = h; surface.layoutParams = lp }
    }

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) { super.onSizeChanged(w, h, ow, oh); fit() }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        // Let the cropped surface be larger than us without the parent shrinking it.
        val w = MeasureSpec.getSize(widthMeasureSpec)
        val h = MeasureSpec.getSize(heightMeasureSpec)
        setMeasuredDimension(w, h)
        for (i in 0 until childCount) {
            val c = getChildAt(i)
            val lp = c.layoutParams
            val cw = if (lp.width > 0) MeasureSpec.makeMeasureSpec(lp.width, MeasureSpec.EXACTLY) else MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY)
            val ch = if (lp.height > 0) MeasureSpec.makeMeasureSpec(lp.height, MeasureSpec.EXACTLY) else MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY)
            c.measure(cw, ch)
        }
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val w = r - l; val h = b - t
        for (i in 0 until childCount) {
            val c = getChildAt(i)
            val x = (w - c.measuredWidth) / 2; val y = (h - c.measuredHeight) / 2
            c.layout(x, y, x + c.measuredWidth, y + c.measuredHeight)
        }
    }

    override fun surfaceCreated(holder: SurfaceHolder) { hasSurface = true; if (wanted) start() }
    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}
    override fun surfaceDestroyed(holder: SurfaceHolder) { hasSurface = false; stopPlayer() }
}

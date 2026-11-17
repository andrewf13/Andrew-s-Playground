package com.drift.launcher

import android.app.Activity
import android.app.ActivityOptions
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.format.DateFormat
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.net.InetSocketAddress
import java.net.Socket
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : Activity() {

    companion object { const val TV_SETTINGS = "com.android.tv.settings" }

    private val main = Handler(Looper.getMainLooper())
    private val bg = Executors.newSingleThreadExecutor()
    private lateinit var store: Store

    private lateinit var root: FrameLayout
    private lateinit var aerial: AerialView
    private lateinit var scrimBottom: View
    private lateinit var bottom: LinearLayout
    private lateinit var clock: TextView
    private lateinit var date: TextView
    private lateinit var net: TextView
    private lateinit var caption: TextView
    private lateinit var focusLabel: TextView
    private lateinit var favRow: LinearLayout
    private lateinit var appRow: LinearLayout
    private lateinit var favScroll: HorizontalScrollView
    private lateinit var appScroll: HorizontalScrollView
    private lateinit var header: LinearLayout
    private lateinit var right: LinearLayout
    private lateinit var nowBox: LinearLayout
    private lateinit var nowArt: ImageView
    private lateinit var nowTitle: TextView
    private lateinit var nowArtist: TextView
    private lateinit var dimLayer: View
    private lateinit var ui: FrameLayout
    private var allAppsOverlay: View? = null
    private var allAppsShowHidden = false
    private var dimmed = false
    private lateinit var nowPlaying: NowPlaying
    private var minutes = 0

    private val sheets = ArrayList<Pair<View, View?>>()   // overlay, view to refocus on close
    private var moving: String? = null
    private var ambient = false
    private var swallowUp = false
    private var resumed = false

    // ---------------------------------------------------------------- lifecycle

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = Store(this)
        CrashLog.install(applicationContext)
        nowPlaying = NowPlaying(this) { showTrack(it) }
        buildUi()
        applyFont()
        if (AppRepo.apps.isNotEmpty()) render()
        reloadApps()
        // First run, and Drift isn't the home screen yet: offer the wizard once the UI has settled.
        if (!store.setupSeen && !isHome()) main.postDelayed({ if (sheets.isEmpty()) openHomeSetup() }, 1200)
        registerReceiver(packages, IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_ADDED); addAction(Intent.ACTION_PACKAGE_REMOVED)
            addAction(Intent.ACTION_PACKAGE_CHANGED); addAction(Intent.ACTION_PACKAGE_REPLACED)
            addDataScheme("package")
        })
    }

    // The aerial runs only while Drift is the resumed, focused activity. Google TV's Settings is a
    // side panel over Drift (Drift is paused, not stopped); keeping 1-2 video decoders running
    // behind it starved the 2 GB Chromecast and got Settings killed.
    override fun onStart() { super.onStart() }
    override fun onStop() { super.onStop(); aerial.stop() }

    /**
     * System screens (Settings, App info, Accessibility...) open in their own task. Inside Drift's
     * task they'd be wiped whenever Drift is brought back as the home screen (singleTask +
     * clearTaskOnLaunch).
     */
    private fun openSystem(i: Intent): Boolean =
        runCatching { startActivity(preferTvSettings(i).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }.isSuccess

    /**
     * TV boxes ship two Settings apps: the TV one (com.android.tv.settings) and a hidden phone-style
     * one that isn't made for a remote. A generic settings intent can land in the phone one, which
     * is why Accessibility "crashed" or couldn't be reached from Drift. Always pick the TV one when
     * it handles the intent.
     */
    private fun preferTvSettings(i: Intent): Intent {
        if (i.component != null || i.`package` != null) return i
        val tv = packageManager.queryIntentActivities(i, 0)
            .firstOrNull { it.activityInfo.packageName.let { p -> p.contains("tv.settings") || p.contains("tvsettings") } }
            ?: return i
        return Intent(i).setClassName(tv.activityInfo.packageName, tv.activityInfo.name)
    }

    private fun hasTvSettings() = runCatching { packageManager.getPackageInfo(TV_SETTINGS, 0); true }.getOrDefault(false)

    /** Accessibility in the TV Settings app; failing that, the TV Settings home (path shown in the wizard). */
    private fun openAccessibility(): Boolean {
        val a = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        val tvHandles = packageManager.queryIntentActivities(a, 0).any { it.activityInfo.packageName == TV_SETTINGS }
        return when {
            tvHandles -> openSystem(a)
            hasTvSettings() -> openSystem(Intent(Settings.ACTION_SETTINGS).setPackage(TV_SETTINGS)) || openSystem(a)
            else -> openSystem(a) || openSystem(Intent(Settings.ACTION_SETTINGS))
        }
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        aerial.start()
        registerReceiver(tick, IntentFilter().apply {
            addAction(Intent.ACTION_TIME_TICK); addAction(Intent.ACTION_TIME_CHANGED); addAction(Intent.ACTION_TIMEZONE_CHANGED)
        })
        updateClock()
        wake()
        probeNet()
        startNowPlaying()
        checkHomeSetup()
    }

    override fun onPause() {
        super.onPause()
        resumed = false
        aerial.stop()
        runCatching { unregisterReceiver(tick) }
        main.removeCallbacks(idle)
        main.removeCallbacks(netLoop)
        nowPlaying.stop()
        main.removeCallbacks(releaseScreen); releaseScreen.run()
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(packages) }
        super.onDestroy()
    }

    /** Home pressed while already home: tidy up and go back to the first favourite. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        while (sheets.isNotEmpty()) closeSheet(refocus = false)
        endMove()
        wake()
        favScroll.scrollTo(0, 0); appScroll.scrollTo(0, 0)
        (favRow.getChildAt(0) ?: appRow.getChildAt(0))?.requestFocus()
    }

    @Deprecated("Back on home does nothing but close what is open.")
    override fun onBackPressed() {
        when {
            moving != null -> endMove()
            sheets.isNotEmpty() -> closeSheet()
            else -> { favScroll.smoothScrollTo(0, 0); favRow.getChildAt(0)?.requestFocus() }
        }
    }

    // ---------------------------------------------------------------- input

    override fun dispatchKeyEvent(e: KeyEvent): Boolean {
        armIdle()
        // Volume, mute and play/pause go straight to the system (and Qobuz), even while faded.
        // (Own list: KeyEvent.isMediaSessionKey() is Android 12+ and crashed the Shield on Android 11.)
        if (e.keyCode in passThroughKeys) return super.dispatchKeyEvent(e)
        if (ambient) {
            if (e.action == KeyEvent.ACTION_DOWN) { swallowUp = true; wake() }
            return true
        }
        if (swallowUp) { if (e.action == KeyEvent.ACTION_UP) swallowUp = false; return true }

        moving?.let { pkg ->
            if (e.action == KeyEvent.ACTION_DOWN) when (e.keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT -> shift(pkg, -1)
                KeyEvent.KEYCODE_DPAD_RIGHT -> shift(pkg, +1)
            }
            if (e.action == KeyEvent.ACTION_UP && e.keyCode in setOf(
                    KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE)) endMove()
            return true
        }

        // Rows don't wrap: at the first/last tile, Left/Right stays put instead of jumping to the other row.
        if (e.action == KeyEvent.ACTION_DOWN && sheets.isEmpty() &&
            (e.keyCode == KeyEvent.KEYCODE_DPAD_LEFT || e.keyCode == KeyEvent.KEYCODE_DPAD_RIGHT)) {
            val f = currentFocus
            val row = f?.parent
            if (f != null && (row === favRow || row === appRow)) {
                val r = row as LinearLayout
                val i = r.indexOfChild(f)
                if ((e.keyCode == KeyEvent.KEYCODE_DPAD_LEFT && i == 0) ||
                    (e.keyCode == KeyEvent.KEYCODE_DPAD_RIGHT && i == r.childCount - 1)) return true
            }
        }

        if (e.keyCode == KeyEvent.KEYCODE_MENU && e.action == KeyEvent.ACTION_UP) {
            val t = currentFocus as? Tile
            if (t != null && AppRepo.find(t.key) != null) appOptions(t.key) else if (sheets.isEmpty()) openSettings()
            return true
        }
        return super.dispatchKeyEvent(e)
    }

    private val passThroughKeys = setOf(
        KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.KEYCODE_VOLUME_MUTE,
        KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
        KeyEvent.KEYCODE_MUTE, KeyEvent.KEYCODE_HEADSETHOOK, KeyEvent.KEYCODE_MEDIA_STOP,
        KeyEvent.KEYCODE_MEDIA_NEXT, KeyEvent.KEYCODE_MEDIA_PREVIOUS, KeyEvent.KEYCODE_MEDIA_REWIND,
        KeyEvent.KEYCODE_MEDIA_RECORD, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD,
    )

    // ---------------------------------------------------------------- ambient

    private val idle = Runnable { if (sheets.isEmpty() && moving == null) goAmbient() }

    private fun armIdle() {
        main.removeCallbacks(idle)
        val s = store.ambientSeconds
        if (s > 0 && resumed) main.postDelayed(idle, s * 1000L)
        holdScreen()
    }

    /**
     * Drift's home screen *is* the screensaver: while it's in front, keep the display awake so the
     * system screensaver (Aerial Dream) doesn't cover it. After [Store.stayOnHours] with no input the
     * hold is released and the TV's own screensaver and sleep timers take over as usual. In every
     * other app nothing changes.
     */
    private val releaseScreen = Runnable { window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }

    private fun holdScreen() {
        main.removeCallbacks(releaseScreen)
        val h = store.stayOnHours
        if (h <= 0 || !resumed) { releaseScreen.run(); return }
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        main.postDelayed(releaseScreen, h * 3_600_000L)
    }

    /** Dim instead of the aerial: always, or only while something is playing (see Settings → Fade to). */
    private fun wantsDim() = when (store.fadeTo) {
        "dim" -> true
        "dim_music" -> nowPlaying.active != null && nowBox.visibility == View.VISIBLE
        else -> false
    }

    private fun goAmbient(force: Boolean = false) {
        val dim = wantsDim()
        if (store.background == "plain" && !force && !dim) return   // nothing to look at without the aerial
        ambient = true
        listOf(bottom, net, scrimBottom).forEach { it.animate().alpha(0f).setDuration(1200).start() }
        if (dim) {
            // Night listening: near-black screen, the aerial stopped, only a faint now playing.
            dimmed = true
            dimLayer.animate().alpha(1f).setDuration(2500).withEndAction { if (dimmed) aerial.stop() }.start()
            listOf(caption, date).forEach { it.animate().alpha(0f).setDuration(1500).start() }
            clock.animate().alpha(0.16f).setDuration(2500).start()
            nowBox.animate().alpha(nowAlpha()).setDuration(2500).start()
        } else {
            // On OLED, static text is dimmer in ambient: lower luminance ages pixels more slowly.
            clock.animate().alpha(if (store.burnIn) 0.72f else 0.9f).setDuration(1200).start()
        }
        pixelShift()
    }

    /** Now playing brightness: full while playing, dimmer when paused, faint in night mode. */
    private var lastPlaying = true
    private fun nowAlpha(): Float = (if (lastPlaying) 1f else 0.55f) * (if (dimmed) 0.32f else 1f)

    /**
     * OLED burn-in protection: every minute the clock block and the info column drift to a new
     * random offset (a few dp while you're using the screen, much further once it has faded to
     * ambient). The move takes four seconds, so it's never noticeable.
     */
    private fun pixelShift() {
        if (!store.burnIn) {
            listOf(header, right).forEach { it.animate().translationX(0f).translationY(0f).setDuration(600).start() }
            return
        }
        fun r(range: Int) = (Math.random().toFloat() * 2f - 1f) * dp(range)
        // The clock block has room to wander; the small corner text stays in its corner.
        val big = if (ambient) 34 else 8
        val small = if (ambient) 12 else 4
        // Night mode: faint text that's on screen for an hour wanders further.
        val bigNow = if (dimmed) 60 else big
        header.animate().translationX(r(bigNow)).translationY(r(bigNow).coerceAtLeast(-dp(24).toFloat())).setDuration(4000).start()
        right.animate().translationX(r(small)).translationY(r(small)).setDuration(4000).start()
    }

    private fun wake() {
        val was = ambient
        ambient = false
        if (dimmed) {
            dimmed = false
            if (resumed) aerial.start()
            dimLayer.animate().alpha(0f).setDuration(400).start()
            date.animate().alpha(0.82f).setDuration(300).start()
            caption.animate().alpha(0.7f).setDuration(300).start()
            nowBox.animate().alpha(nowAlpha()).setDuration(300).start()
        }
        if (was) pixelShift()   // ease back from the wide ambient drift
        listOf(bottom, net, scrimBottom, clock).forEach { it.animate().alpha(1f).setDuration(if (was) 260 else 0).start() }
        armIdle()
    }

    // ---------------------------------------------------------------- layout

    private fun text(sizeSp: Float, family: String, alpha: Float = 1f) = TextView(this).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        typeface = Typeface.create(family, Typeface.NORMAL)
        setTextColor(Color.WHITE)
        this.alpha = alpha
        setShadowLayer(dp(10).toFloat(), 0f, dp(1).toFloat(), 0x80000000.toInt())
        includeFontPadding = false
    }

    private fun buildUi() {
        val M = FrameLayout.LayoutParams.MATCH_PARENT
        val W = FrameLayout.LayoutParams.WRAP_CONTENT
        root = FrameLayout(this).apply { clipChildren = false }

        aerial = AerialView(this, store) { label -> showCaption(label) }
        root.addView(aerial, FrameLayout.LayoutParams(M, M))

        root.addView(View(this).apply { setBackgroundResource(R.drawable.scrim_top) },
            FrameLayout.LayoutParams(M, dp(220), Gravity.TOP))
        scrimBottom = View(this).apply { setBackgroundResource(R.drawable.scrim) }
        root.addView(scrimBottom, FrameLayout.LayoutParams(M, dp(330), Gravity.BOTTOM))
        // Night listening: fades in over the aerial so only a faint "now playing" remains.
        dimLayer = View(this).apply { setBackgroundColor(Color.BLACK); alpha = 0f }
        root.addView(dimLayer, FrameLayout.LayoutParams(M, M))

        ui = FrameLayout(this).apply { clipChildren = false; clipToPadding = false; setPadding(dp(56), dp(40), dp(56), dp(30)) }
        root.addView(ui, FrameLayout.LayoutParams(M, M))

        // Top left: the time, very large and very thin. Nothing else competes with it.
        header = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        clock = text(76f, "sans-serif-thin").apply { letterSpacing = -0.02f }
        date = text(12.5f, "sans-serif-medium", 0.82f).apply { letterSpacing = 0.22f; setPadding(dp(4), dp(6), 0, 0) }
        header.addView(clock); header.addView(date)

        // Now playing (Qobuz or any player): album art, track, artist. Shown only while music plays.
        nowBox = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            visibility = View.GONE; alpha = 0f
            setPadding(dp(4), dp(26), 0, 0)
        }
        nowArt = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            clipToOutline = true
            outlineProvider = object : android.view.ViewOutlineProvider() {
                override fun getOutline(v: View, o: android.graphics.Outline) = o.setRoundRect(0, 0, v.width, v.height, dp(6).toFloat())
            }
            elevation = dp(6).toFloat()
        }
        nowBox.addView(nowArt, LinearLayout.LayoutParams(dp(52), dp(52)).apply { rightMargin = dp(14) })
        val nowText = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        nowTitle = marquee(text(17f, "sans-serif-medium"))
        nowArtist = marquee(text(13.5f, "sans-serif", 0.75f)).apply { setPadding(0, dp(4), 0, 0) }
        // Both lines get the same fixed width (so one can't clip the other); long text scrolls.
        nowText.addView(nowTitle, LinearLayout.LayoutParams(dp(440), LinearLayout.LayoutParams.WRAP_CONTENT))
        nowText.addView(nowArtist, LinearLayout.LayoutParams(dp(440), LinearLayout.LayoutParams.WRAP_CONTENT))
        nowBox.addView(nowText)
        header.addView(nowBox)

        ui.addView(header, FrameLayout.LayoutParams(W, W, Gravity.TOP or Gravity.START))

        // Top right: connection + where the aerial was filmed.
        // Fixed width, every line right-aligned: "11 ms" -> "321 ms" or a longer place name can't move it.
        right = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.END }
        net = text(12f, "sans-serif-medium", 0.85f).apply { compoundDrawablePadding = dp(7); letterSpacing = 0.06f; gravity = Gravity.END }
        caption = text(12f, "sans-serif", 0.7f).apply { letterSpacing = 0.12f; setPadding(0, dp(8), 0, 0); gravity = Gravity.END; isSingleLine = true; ellipsize = android.text.TextUtils.TruncateAt.END }
        // Snug width (the status dot sits right beside the text), pinned to the right edge.
        right.addView(net, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { gravity = Gravity.END })
        right.addView(caption, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        ui.addView(right, FrameLayout.LayoutParams(dp(320), W, Gravity.TOP or Gravity.END).apply { topMargin = dp(10) })

        // Bottom: favourites (large), the focused app's name, then everything else (small).
        bottom = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; clipChildren = false; clipToPadding = false }
        favRow = row(); favScroll = scroller(favRow, dp(16))
        appRow = row(); appScroll = scroller(appRow, dp(12))
        focusLabel = text(15f, "sans-serif-medium").apply { letterSpacing = 0.02f; setPadding(dp(2), dp(4), 0, dp(6)) }
        bottom.addView(favScroll)
        bottom.addView(focusLabel)
        bottom.addView(appScroll)
        ui.addView(bottom, FrameLayout.LayoutParams(M, W, Gravity.BOTTOM))

        setContentView(root)
    }

    /** One line that scrolls slowly when it doesn't fit, with soft faded edges; still when it does. */
    private fun marquee(v: TextView) = v.apply {
        isSingleLine = true
        ellipsize = android.text.TextUtils.TruncateAt.MARQUEE
        marqueeRepeatLimit = -1
        isHorizontalFadingEdgeEnabled = true
        setFadingEdgeLength(dp(24))
        isSelected = true          // marquee runs without the view needing focus
    }

    private fun row() = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL; clipChildren = false; clipToPadding = false
    }

    private fun scroller(child: LinearLayout, pad: Int) = HorizontalScrollView(this).apply {
        isHorizontalScrollBarEnabled = false
        isHorizontalFadingEdgeEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
        clipChildren = false; clipToPadding = false
        isSmoothScrollingEnabled = true
        setPadding(0, pad, 0, pad)
        addView(child)
    }

    // ---------------------------------------------------------------- rows

    private val favW get() = dp(194)
    private val favH get() = dp(109)
    private val appW get() = dp(128)
    private val appH get() = dp(72)

    private fun render() {
        val focusedKey = (currentFocus as? Tile)?.key
        val focusedInFavs = currentFocus?.parent == favRow
        val apps = AppRepo.apps
        val favs = store.favourites(apps)
        val hidden = store.hidden

        favRow.removeAllViews()
        favs.mapNotNull { AppRepo.find(it) }.forEachIndexed { i, a ->
            favRow.addView(appTile(a, favW, favH, 1.10f), gap(i, dp(22), favW, favH))
        }

        appRow.removeAllViews()
        var i = 0
        apps.filter { it.pkg !in favs && it.pkg !in hidden }.forEach { a ->
            appRow.addView(appTile(a, appW, appH, 1.12f), gap(i++, dp(14), appW, appH))
        }
        appRow.addView(glyphTile("All apps", R.drawable.ic_grid) { openAllApps() }, gap(i++, dp(14), appW, appH))
        appRow.addView(glyphTile("Screensaver", R.drawable.ic_moon) { startScreensaver() }, gap(i++, dp(14), appW, appH))
        appRow.addView(glyphTile("Settings", R.drawable.ic_sliders) { openSettings() }, gap(i, dp(14), appW, appH))

        if (favRow.childCount == 0) {
            // First run with nothing matched yet: the apps row carries the focus.
            focusLabel.text = "Hold OK on any app to add it to favourites"
        }

        if (sheets.isNotEmpty()) return
        val target = focusedKey?.let { k -> (if (focusedInFavs) favRow else appRow).findTile(k) ?: favRow.findTile(k) ?: appRow.findTile(k) }
        (target ?: favRow.getChildAt(0) ?: appRow.getChildAt(0))?.requestFocus()
    }

    private fun LinearLayout.findTile(key: String): Tile? =
        (0 until childCount).map { getChildAt(it) }.firstOrNull { (it as? Tile)?.key == key } as Tile?

    private fun gap(index: Int, px: Int, w: Int, h: Int) =
        LinearLayout.LayoutParams(w, h).apply { if (index > 0) leftMargin = px }

    private fun appTile(a: AppEntry, w: Int, h: Int, scale: Float) =
        Tile(this, a.pkg, a.label, a.banner, a.icon, w, h, scale).apply {
            setOnClickListener { launch(a.pkg, this) }
            setOnLongClickListener { appOptions(a.pkg); true }
            onFocusChangeListener = View.OnFocusChangeListener { _, f -> if (f && moving == null) focusLabel.text = a.label }
        }

    private fun glyphTile(label: String, icon: Int, action: () -> Unit) =
        Tile(this, "glyph:$label", label, null, getDrawable(icon), appW, appH, 1.12f, glyph = true).apply {
            setOnClickListener { action() }
            onFocusChangeListener = View.OnFocusChangeListener { _, f -> if (f) focusLabel.text = label }
        }

    // ---------------------------------------------------------------- apps

    private var reloadPending = false

    private fun reloadApps() {
        if (reloadPending) return
        reloadPending = true
        bg.execute {
            AppRepo.load(applicationContext)
            main.post { reloadPending = false; render() }
        }
    }

    private val packages = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) { main.postDelayed({ reloadApps() }, 400) }
    }

    private fun launch(pkg: String, from: View?) {
        val intent = AppRepo.launchIntent(this, pkg) ?: return
        val opts = from?.let { ActivityOptions.makeScaleUpAnimation(it, 0, 0, it.width, it.height).toBundle() }
        runCatching { startActivity(intent, opts) }.onFailure { runCatching { startActivity(intent) } }
    }

    /**
     * Android TV gives apps no public way to start the system screensaver, so:
     *  1. Aerial Dream has an exported full-screen player (TestActivity) - the same screensaver, as an app.
     *  2. The AOSP "start dreaming" shortcut, where the TV build still has it (not on Google TV).
     *  3. Otherwise Drift's own aerial fills the screen. It never dumps you in Settings.
     */
    private fun startScreensaver() {
        val tries = listOf(
            ComponentName(Aerials.AERIAL_DREAM, "${Aerials.AERIAL_DREAM}.TestActivity"),
            ComponentName("com.android.systemui", "com.android.systemui.Somnambulator"),
        )
        for (c in tries) {
            val i = Intent(Intent.ACTION_MAIN).setComponent(c).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (i.resolveActivityInfo(packageManager, 0)?.exported != true) continue
            if (runCatching { startActivity(i) }.isSuccess) return
        }
        goAmbient(force = true)
    }

    // ---------------------------------------------------------------- favourites editing

    private fun favs() = store.favourites(AppRepo.apps).toMutableList()

    private fun beginMove(pkg: String) {
        val t = favRow.findTile(pkg) ?: return
        moving = pkg
        t.requestFocus()
        t.lifted = true
        focusLabel.text = "◀  ▶   move      OK   done"
    }

    private fun shift(pkg: String, by: Int) {
        val list = favs()
        val from = list.indexOf(pkg)
        val to = from + by
        if (from < 0 || to !in list.indices) return
        list.removeAt(from); list.add(to, pkg)
        store.setFavourites(list)
        val v = favRow.getChildAt(from)
        favRow.removeViewAt(from)
        favRow.addView(v, to)
        for (k in 0 until favRow.childCount) {
            (favRow.getChildAt(k).layoutParams as LinearLayout.LayoutParams).leftMargin = if (k == 0) 0 else dp(22)
        }
        favRow.requestLayout()
        v.requestFocus()
        v.post { favScroll.requestChildFocus(v, v) }
    }

    private fun endMove() {
        val pkg = moving ?: return
        moving = null
        favRow.findTile(pkg)?.let { it.lifted = false; it.requestFocus(); focusLabel.text = it.label }
    }

    // ---------------------------------------------------------------- sheets

    private fun openSheet(content: View, gravity: Int = Gravity.CENTER, widthDp: Int = 440): View {
        val overlay = FrameLayout(this).apply {
            setBackgroundColor(0xB3000000.toInt())
            isClickable = true
            alpha = 0f
        }
        val lp = if (widthDp > 0) FrameLayout.LayoutParams(dp(widthDp), FrameLayout.LayoutParams.WRAP_CONTENT, gravity)
            .apply { topMargin = dp(32); bottomMargin = dp(32) }   // a long sheet scrolls rather than touching the edges
        else FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        overlay.addView(content, lp)
        sheets.add(overlay to currentFocus)
        // Trap focus in the new sheet: nothing underneath (the home rows, or an earlier sheet) can
        // take focus, so pressing past the edge of a sheet stays in it instead of selecting tiles
        // behind it.
        ui.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
        sheets.dropLast(1).forEach { (o, _) -> (o as ViewGroup).descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS }
        root.addView(overlay, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        overlay.animate().alpha(1f).setDuration(140).start()
        main.removeCallbacks(idle)
        overlay.post { firstFocusable(content)?.requestFocus() }
        return overlay
    }

    private fun firstFocusable(v: View): View? {
        if (v.isFocusable && v.isClickable) return v
        if (v is ViewGroup) for (i in 0 until v.childCount) firstFocusable(v.getChildAt(i))?.let { return it }
        return null
    }

    private fun closeSheet(refocus: Boolean = true) {
        val (overlay, back) = sheets.removeLastOrNull() ?: return
        root.removeView(overlay)
        if (overlay === allAppsOverlay) allAppsOverlay = null
        // Hand focus back to whatever is now on top.
        val top = sheets.lastOrNull()?.first as ViewGroup?
        if (top != null) top.descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
        else ui.descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
        if (refocus) (back?.takeIf { it.isAttachedToWindow } ?: favRow.getChildAt(0) ?: appRow.getChildAt(0))?.requestFocus()
        armIdle()
    }

    private fun panel(title: String?): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = GradientDrawable().apply { cornerRadius = dp(22).toFloat(); setColor(0xF2121620.toInt()) }
        setPadding(dp(14), dp(18), dp(14), dp(14))
        elevation = dp(24).toFloat()
        if (title != null) addView(text(13f, "sans-serif-medium", 0.6f).apply {
            text = title.uppercase(Locale.getDefault()); letterSpacing = 0.2f
            setShadowLayer(0f, 0f, 0f, 0); setPadding(dp(18), dp(4), dp(18), dp(12))
        })
    }

    private fun LinearLayout.action(title: String, value: String? = null, onClick: (FrameLayout) -> Unit): FrameLayout {
        val r = sheetRow(title, value)
        r.setOnClickListener { onClick(r) }
        addView(r, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(2) })
        return r
    }

    private fun appOptions(pkg: String) {
        val app = AppRepo.find(pkg) ?: return
        val favs = favs()
        val isFav = pkg in favs
        val isHidden = pkg in store.hidden
        val p = panel(app.label)
        p.action("Open") { closeSheet(false); launch(pkg, null) }
        if (isFav) {
            p.action("Move") { while (sheets.isNotEmpty()) closeSheet(false); beginMove(pkg) }
            p.action("Remove from favourites") { store.setFavourites(favs - pkg); closeAll(); render() }
        } else {
            p.action("Add to favourites") {
                store.setFavourites(favs + pkg); store.hidden = store.hidden - pkg
                closeAll(); render(); favRow.findTile(pkg)?.requestFocus()
            }
        }
        // Hide = gone from the home row AND All apps (it's listed under "Hidden apps" to bring back).
        if (isHidden) p.action("Show again") { store.hidden = store.hidden - pkg; afterHideChange(pkg) }
        else if (!isFav) p.action("Hide") { store.hidden = store.hidden + pkg; afterHideChange(pkg) }
        p.action("App info") {
            closeAll()
            openSystem(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")))
        }
        p.action("Uninstall") {
            closeAll()
            openSystem(Intent(Intent.ACTION_DELETE, Uri.parse("package:$pkg")))
        }
        openSheet(p)
    }

    /** After hiding/unhiding: refresh home, and if All apps was open, rebuild it in place so you can keep going. */
    private fun afterHideChange(pkg: String) {
        val fromAllApps = allAppsOverlay != null
        val index = currentAllAppsIndex
        closeAll()
        render()
        if (fromAllApps) openAllApps(allAppsShowHidden && store.hidden.isNotEmpty(), index)
    }

    private var currentAllAppsIndex = 0

    private fun closeAll() { while (sheets.isNotEmpty()) closeSheet(refocus = sheets.size == 1) }

    private fun openSettings() {
        val p = panel("Drift")
        val bgNames = mapOf("aerial" to "Aerial video", "still" to "Aerial still", "plain" to "Plain")
        val qNames = mapOf("1080" to "1080p  ·  lightest", "4k" to "4K")
        val clockNames = mapOf("system" to "System", "24" to "24-hour", "12" to "12-hour")
        val ambientSteps = listOf(20, 45, 120, 300, 0)
        fun ambientName(s: Int) = when { s == 0 -> "Never"; s < 60 -> "$s s"; else -> "${s / 60} min" }

        p.action("Background", bgNames[store.background]) { r ->
            store.background = when (store.background) { "aerial" -> "still"; "still" -> "plain"; else -> "aerial" }
            r.setRowValue(bgNames[store.background]!!)
            aerial.stop(); aerial.start()
        }
        p.action("Aerial quality", qNames[store.quality]) { r ->
            store.quality = if (store.quality == "1080") "4k" else "1080"
            r.setRowValue(qNames[store.quality]!!)
            aerial.skip()
        }
        p.action("Next aerial") { aerial.skip() }
        p.action("Clock", clockNames[store.clock]) { r ->
            store.clock = when (store.clock) { "system" -> "24"; "24" -> "12"; else -> "system" }
            r.setRowValue(clockNames[store.clock]!!); updateClock()
        }
        p.action("Clock font", Fonts.names[store.font]) { r ->
            store.font = Fonts.styles[(Fonts.styles.indexOf(store.font) + 1) % Fonts.styles.size]
            r.setRowValue(Fonts.names[store.font]!!); applyFont()
        }
        p.action("Burn-in protection", if (store.burnIn) "On" else "Off") { r ->
            store.burnIn = !store.burnIn
            r.setRowValue(if (store.burnIn) "On" else "Off"); pixelShift()
        }
        val npNames = mapOf("any" to "Any player", "qobuz" to "Qobuz only", "off" to "Off")
        fun npValue() = if (store.nowPlaying != "off" && !NowPlaying.canShow(this)) "Needs access" else npNames[store.nowPlaying]!!
        p.action("Now playing", npValue()) { r ->
            store.nowPlaying = when (store.nowPlaying) { "any" -> "qobuz"; "qobuz" -> "off"; else -> "any" }
            r.setRowValue(npValue()); startNowPlaying()
            // Turned on without permission yet: go straight to the steps instead of a hidden extra row.
            if (store.nowPlaying != "off" && !NowPlaying.canShow(this)) openAccessGuide()
        }
        if (store.nowPlaying != "off" && !NowPlaying.canShow(this)) p.action("Allow now playing…") { openAccessGuide() }
        val staySteps = listOf(1, 4, 8, 0)
        fun stayName(h: Int) = if (h == 0) "Off · system screensaver" else "$h h"
        p.action("Stay on at home", stayName(store.stayOnHours)) { r ->
            store.stayOnHours = staySteps[(staySteps.indexOf(store.stayOnHours) + 1) % staySteps.size]
            r.setRowValue(stayName(store.stayOnHours)); holdScreen()
        }
        val fadeNames = mapOf("aerial" to "Aerial", "dim_music" to "Dim when music plays", "dim" to "Dim always")
        p.action("Fade to", fadeNames[store.fadeTo]) { r ->
            store.fadeTo = when (store.fadeTo) { "aerial" -> "dim_music"; "dim_music" -> "dim"; else -> "aerial" }
            r.setRowValue(fadeNames[store.fadeTo]!!)
        }
        p.action("Fade after", ambientName(store.ambientSeconds)) { r ->
            val i = ambientSteps.indexOf(store.ambientSeconds)
            store.ambientSeconds = ambientSteps[(i + 1) % ambientSteps.size]
            r.setRowValue(ambientName(store.ambientSeconds))
        }
        p.action("Start screensaver") { closeAll(); startScreensaver() }
        if (store.hidden.isNotEmpty()) p.action("Show hidden apps", "${store.hidden.size}") { store.hidden = emptySet(); closeAll(); render() }
        p.action("Home screen", if (isHome()) "Drift ✓" else "Set up…") { closeAll(); openHomeSetup() }
        p.action("Android settings") { closeAll(); openSystem(Intent(Settings.ACTION_SETTINGS)) }
        // Diagnostics: where the aerial list came from, and the last thing that went wrong (if anything).
        p.addView(text(11.5f, "sans-serif", 0.55f).apply {
            setShadowLayer(0f, 0f, 0f, 0)
            text = (CrashLog.last(this@MainActivity)?.let { "Last crash: $it\n" } ?: "") + "Aerials: ${Aerials.status}" + (Aerials.lastError?.let { "\n$it" } ?: "") +
                (if (store.nowPlaying != "off" && !NowPlaying.canShow(this@MainActivity)) "\nNow playing: not allowed yet" else "")
            setPadding(dp(18), dp(12), dp(18), dp(2))
        })
        // Taller than a 1080p screen now, so let it scroll; focus moves keep the row in view.
        val scroll = ScrollView(this).apply {
            isVerticalScrollBarEnabled = false; isVerticalFadingEdgeEnabled = true; setFadingEdgeLength(dp(20))
            addView(p)
        }
        openSheet(scroll, widthDp = 480)
    }

    /**
     * All apps: every app except hidden ones, then a "Hidden apps" tile that reveals those (dimmed)
     * so they can be brought back. Hold OK on any app for its options.
     */
    private fun openAllApps(showHidden: Boolean = false, focusIndex: Int = 0) {
        allAppsShowHidden = showHidden
        val wrap = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(56), dp(40), dp(56), 0)
            clipChildren = false; clipToPadding = false
        }
        wrap.addView(text(30f, "sans-serif-light").apply { text = "All apps"; setPadding(0, 0, 0, dp(16)) })
        val cols = 5
        val gapPx = dp(18)
        val tileW = (resources.displayMetrics.widthPixels - dp(112) - gapPx * (cols - 1)) / cols
        val tileH = tileW * 9 / 16
        val grid = GridLayout(this).apply { columnCount = cols; clipChildren = false; clipToPadding = false; setPadding(0, dp(8), 0, dp(40)) }
        val hidden = store.hidden
        val label = text(14f, "sans-serif-medium", 0.9f)
        val visible = AppRepo.apps.filter { it.pkg !in hidden }
        val shownHidden = if (showHidden) AppRepo.apps.filter { it.pkg in hidden } else emptyList()
        val tiles = ArrayList<View>()
        fun place(v: View) {
            val i = tiles.size
            tiles += v
            grid.addView(v, GridLayout.LayoutParams().apply {
                width = tileW; height = tileH
                if (i % cols != 0) leftMargin = gapPx
                if (i >= cols) topMargin = gapPx
            })
        }
        for (a in visible + shownHidden) {
            val isHidden = a.pkg in hidden
            place(Tile(this, a.pkg, a.label, a.banner, a.icon, tileW, tileH, 1.08f, restAlpha = if (isHidden) 0.3f else 0.78f).apply {
                setOnClickListener { closeAll(); launch(a.pkg, null) }
                setOnLongClickListener { appOptions(a.pkg); true }
                onFocusChangeListener = View.OnFocusChangeListener { v, f ->
                    if (f) { label.text = a.label + if (isHidden) "  ·  hidden" else ""; currentAllAppsIndex = tiles.indexOf(v) }
                }
            })
        }
        if (hidden.isNotEmpty()) {
            val name = if (showHidden) "Hide hidden apps" else "Hidden apps (${hidden.size})"
            place(Tile(this, "glyph:hidden", name, null, getDrawable(R.drawable.ic_grid), tileW, tileH, 1.08f, glyph = true).apply {
                setOnClickListener { val i = tiles.indexOf(this); closeAll(); openAllApps(!showHidden, i) }
                onFocusChangeListener = View.OnFocusChangeListener { v, f ->
                    if (f) { label.text = if (showHidden) "Hide these again" else "Show ${hidden.size} hidden app" + (if (hidden.size == 1) "" else "s") + " (dimmed)"; currentAllAppsIndex = tiles.indexOf(v) }
                }
            })
        }
        val scroll = ScrollView(this).apply {
            isVerticalScrollBarEnabled = false; isVerticalFadingEdgeEnabled = true; setFadingEdgeLength(dp(24))
            clipChildren = false; clipToPadding = false; addView(grid)
        }
        wrap.addView(label)
        wrap.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT))
        val overlay = openSheet(wrap, widthDp = 0)
        // Solid, so the home screen doesn't show through.
        overlay.setBackgroundResource(R.drawable.window_bg)
        allAppsOverlay = overlay
        tiles.getOrNull(focusIndex.coerceIn(0, (tiles.size - 1).coerceAtLeast(0)))?.let { t -> t.post { t.requestFocus() } }
    }

    // ---------------------------------------------------------------- clock, caption, network

    private val tick = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            updateClock()
            if (i.action != Intent.ACTION_TIME_TICK) return
            pixelShift()
            // A paused "still" frame is static content too: swap it for a new aerial every 5 minutes.
            if (++minutes % 5 == 0 && store.background == "still" && store.burnIn) aerial.skip()
        }
    }

    private fun applyFont() {
        val f = Fonts.get(this, store.font)
        clock.typeface = f.clock; clock.letterSpacing = f.clockSpacing
        clock.setTextSize(TypedValue.COMPLEX_UNIT_SP, f.clockSp)
        date.typeface = f.label
        caption.typeface = f.text
        nowTitle.typeface = f.label
        nowArtist.typeface = f.text
    }

    // ---------------------------------------------------------------- home screen setup (no ADB)

    private val roleRequest = 41
    private var awaitingHome = false

    /** Home button opens Drift: it's the resolved HOME app, or the Home-button helper is on. */
    private fun isHome(): Boolean = isDefaultHome() || HomeGuard.isOn(this)

    private fun isDefaultHome(): Boolean =
        packageManager.resolveActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
            ?.activityInfo?.packageName == packageName

    private fun roleIntent(): Intent? {
        if (android.os.Build.VERSION.SDK_INT < 29) return null
        val rm = getSystemService(android.app.role.RoleManager::class.java) ?: return null
        if (!rm.isRoleAvailable(android.app.role.RoleManager.ROLE_HOME) || rm.isRoleHeld(android.app.role.RoleManager.ROLE_HOME)) return null
        return rm.createRequestRoleIntent(android.app.role.RoleManager.ROLE_HOME).takeIf { it.resolveActivity(packageManager) != null }
    }

    /**
     * The wizard. Two routes, both done with the remote:
     *  1. Ask Android to make Drift the default home app (some TV builds honour this; Google TV ignores it).
     *  2. Turn on "Drift Home button" in Accessibility. Works on Google TV and the Shield: whenever
     *     the built-in home screen appears, Drift comes straight back.
     * The screensaver needs nothing: Drift keeps the TV awake while it's on screen.
     */
    private fun openHomeSetup() {
        store.setupSeen = true
        val p = panel("Home screen")
        fun para(t: String, a: Float = 0.8f) = text(14f, "sans-serif", a).apply {
            setShadowLayer(0f, 0f, 0f, 0); text = t; setLineSpacing(dp(4).toFloat(), 1f); setPadding(dp(18), 0, dp(18), dp(14))
        }
        val default = isDefaultHome()
        val guard = HomeGuard.isOn(this)
        when {
            default -> p.addView(para("Drift is your home screen. The Home button opens it."))
            guard -> p.addView(para("The Home button opens Drift. You may see the old home screen for a split second before Drift comes back."))
            else -> p.addView(para("Make the Home button on your remote open Drift instead of the built-in home screen. No computer needed."))
        }
        if (!default) {
            roleIntent()?.let { intent ->
                p.action("Set Drift as the home app") {
                    awaitingHome = true
                    runCatching { startActivityForResult(intent, roleRequest) }
                }
            }
            if (!guard) {
                p.addView(para("Then turn on the Home button helper. In the screen that opens, choose “Drift Home button” and switch it on. Press Back to come back here.", 0.65f))
                p.action("Turn on Home button helper") {
                    awaitingHome = true
                    openAccessibility()
                }
                p.addView(para("If Drift isn't listed on the screen that opens, go to Accessibility yourself: " +
                    "Shield: Settings → Device Preferences → Accessibility.  Google TV: Settings → System → Accessibility.", 0.5f))
                p.addView(para("If the switch is greyed out: Android Settings → Apps → Drift → ⋮ → Allow restricted settings, then try again.", 0.5f))
            }
        }
        p.addView(para("The screensaver is handled automatically. Drift keeps the TV awake while it's on screen (Settings → Stay on at home). Other apps keep your usual screensaver.", 0.5f))
        p.action(if (isHome()) "Done" else "Not now") { closeSheet() }
        openSheet(p, widthDp = 560)
    }

    @Deprecated("Activity result for the home-role request.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == roleRequest) checkHomeSetup()
    }

    /** Back from Android settings: if it worked, say so and close the wizard. */
    private fun checkHomeSetup() {
        if (!awaitingHome) return
        if (isHome()) {
            awaitingHome = false
            closeAll()
            focusLabel.text = "The Home button now opens Drift"
        } else if (sheets.isNotEmpty()) {
            closeAll(); openHomeSetup()   // refresh: show whichever step is still left
        }
    }

    // ---------------------------------------------------------------- now playing access

    private var awaitingGrant = false

    /** The Android screens that can grant notification access, most direct first. Only ones this TV has. */
    private fun accessIntents(): List<Intent> {
        val me = ComponentName(this, MediaListener::class.java).flattenToString()
        val list = mutableListOf<Intent>()
        if (android.os.Build.VERSION.SDK_INT >= 30) list += Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
            .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, me)
        list += Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        list += Intent("android.settings.MANAGE_SPECIAL_APP_ACCESS_SETTINGS")
        return list.filter { it.resolveActivity(packageManager) != null }
    }

    /**
     * A short explainer, then straight into Android's Notification access screen with Drift selected.
     * When you come back, Drift checks again and turns now playing on by itself.
     */
    private fun openAccessGuide() {
        val p = panel("Now playing")
        val lowRam = getSystemService(android.app.ActivityManager::class.java).isLowRamDevice
        val intents = accessIntents()
        fun para(t: String, a: Float = 0.8f) = text(14f, "sans-serif", a).apply {
            setShadowLayer(0f, 0f, 0f, 0); text = t; setLineSpacing(dp(4).toFloat(), 1f); setPadding(dp(18), 0, dp(18), dp(14))
        }
        p.addView(para("To show what Qobuz is playing, Android needs you to give Drift “notification access”. " +
            "Drift only reads the track, artist and cover art. It never reads your notifications."))
        when {
            lowRam || intents.isEmpty() -> {
                // No notification-access screen on this TV (the Shield): use the Home button helper,
                // which picks up the player link from music notifications instead.
                p.addView(para("This TV has no screen for that permission, so Drift uses its Home button helper instead. " +
                    "Turn it on in Accessibility: choose “Drift Home button” and switch it on, then press Back.", 0.65f))
                p.action("Turn on Home button helper") { awaitingGrant = true; openAccessibility() }
                p.addView(para("Shield: Settings → Device Preferences → Accessibility.  Google TV: Settings → System → Accessibility. " +
                    "If music is already playing, pause and play it once so Drift picks it up.", 0.5f))
                if (!lowRam) p.addView(para("Or, once from a computer: " + NowPlaying.GRANT, 0.4f).apply { setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f) })
            }
            else -> {
                p.addView(para("Choose Drift on the next screen and switch it on. Press Back to return here.", 0.65f))
                p.action("Open notification access") {
                    for (i in intents) if (openSystem(i)) { awaitingGrant = true; break }
                }
            }
        }
        p.action("Not now") { closeSheet() }
        openSheet(p, widthDp = 520)
    }

    private fun startNowPlaying() {
        if (awaitingGrant && NowPlaying.canShow(this)) {
            awaitingGrant = false
            closeAll()
            focusLabel.text = "Now playing is on"
        }
        if (store.nowPlaying == "off") { nowPlaying.stop(); showTrack(null); return }
        nowPlaying.stop()
        if (!nowPlaying.start(qobuzOnly = store.nowPlaying == "qobuz")) showTrack(null)
    }

    private fun showTrack(t: Track?) {
        if (t == null) {
            if (nowBox.visibility == View.VISIBLE) nowBox.animate().alpha(0f).setDuration(500).withEndAction { nowBox.visibility = View.GONE }.start()
            return
        }
        val apply = {
            nowTitle.text = t.title
            nowArtist.text = t.subtitle
            nowArt.setImageBitmap(t.art)
            nowArt.visibility = if (t.art != null) View.VISIBLE else View.GONE
        }
        lastPlaying = t.playing
        val target = nowAlpha()   // paused: dimmer; night mode: faint
        if (nowBox.visibility != View.VISIBLE) {
            apply(); nowBox.visibility = View.VISIBLE
            nowBox.animate().alpha(target).setDuration(700).start()
        } else if (nowTitle.text != t.title) {
            nowBox.animate().alpha(0f).setDuration(250).withEndAction { apply(); nowBox.animate().alpha(target).setDuration(500).start() }.start()
        } else { apply(); nowBox.animate().alpha(target).setDuration(400).start() }
    }

    private fun updateClock() {
        val h24 = when (store.clock) { "24" -> true; "12" -> false; else -> DateFormat.is24HourFormat(this) }
        val now = Date()
        clock.text = DateFormat.format(if (h24) "H:mm" else "h:mm", now)
        val pattern = DateFormat.getBestDateTimePattern(Locale.getDefault(), "EEEEdMMMM")
        date.text = DateFormat.format(pattern, now).toString().uppercase(Locale.getDefault())
    }

    private fun showCaption(label: String) {
        caption.animate().cancel()
        caption.animate().alpha(0f).setDuration(200).withEndAction {
            caption.text = label.uppercase(Locale.getDefault())
            caption.animate().alpha(0.7f).setDuration(600).start()
        }.start()
    }

    private val netLoop = Runnable { probeNet() }

    private fun probeNet() {
        main.removeCallbacks(netLoop)
        bg.execute {
            val cm = getSystemService(ConnectivityManager::class.java)
            val caps = cm.activeNetwork?.let { cm.getNetworkCapabilities(it) }
            val kind = when {
                caps == null -> null
                caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi‑Fi"
                else -> "Online"
            }
            // Best of three TCP handshakes: one slow sample (Wi-Fi power save waking up) shouldn't read as lag.
            val ms = if (kind == null) null else (1..3).mapNotNull {
                runCatching {
                    val t0 = System.nanoTime()
                    Socket().use { s -> s.connect(InetSocketAddress("1.1.1.1", 443), 2000) }
                    ((System.nanoTime() - t0) / 1_000_000).toInt()
                }.getOrNull()
            }.minOrNull()
            main.post {
                val (txt, colour) = when {
                    kind == null -> "Offline" to 0xFFFF5A5F.toInt()
                    ms == null -> "$kind  ·  no internet" to 0xFFFFB443.toInt()
                    else -> "$kind  ·  $ms ms" to if (ms < 60) 0xFF4BE08A.toInt() else 0xFFFFB443.toInt()
                }
                net.text = txt
                val dot = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(colour); setSize(dp(7), dp(7)) }
                net.setCompoundDrawablesRelativeWithIntrinsicBounds(dot, null, null, null)
                if (resumed) main.postDelayed(netLoop, 30_000)
            }
        }
    }
}

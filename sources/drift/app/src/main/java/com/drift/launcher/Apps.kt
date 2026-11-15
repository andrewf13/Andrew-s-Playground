package com.drift.launcher

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ResolveInfo
import android.graphics.drawable.Drawable

class AppEntry(
    val pkg: String,
    val label: String,
    val banner: Drawable?,
    val icon: Drawable,
)

/** Every launchable app on the box, loaded once off the main thread and kept in memory. */
object AppRepo {
    @Volatile
    var apps: List<AppEntry> = emptyList()
        private set

    fun load(ctx: Context): List<AppEntry> {
        val pm = ctx.packageManager
        val found = LinkedHashMap<String, ResolveInfo>()
        // TV apps first (they carry proper 16:9 banners), then phone-style apps such as network tools.
        pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER), 0)
            .forEach { found[it.activityInfo.packageName] = it }
        pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
            .forEach { found.putIfAbsent(it.activityInfo.packageName, it) }
        found.remove(ctx.packageName)

        val list = found.values.map { ri ->
            val ai = ri.activityInfo
            val banner = runCatching { ai.loadBanner(pm) ?: ai.applicationInfo.loadBanner(pm) }.getOrNull()
            AppEntry(ai.packageName, ri.loadLabel(pm).toString().trim(), banner, ri.loadIcon(pm))
        }.sortedBy { it.label.lowercase() }
        apps = list
        return list
    }

    fun find(pkg: String) = apps.firstOrNull { it.pkg == pkg }

    fun launchIntent(ctx: Context, pkg: String): Intent? {
        val pm = ctx.packageManager
        return (pm.getLeanbackLaunchIntentForPackage(pkg) ?: pm.getLaunchIntentForPackage(pkg))
            ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    }
}

/** User choices. Favourites follow a sensible default until the user edits them for the first time. */
class Store(ctx: Context) {
    private val p: SharedPreferences = ctx.getSharedPreferences("drift", Context.MODE_PRIVATE)

    /** Default favourite slots: known package names first, then a label match. */
    private val defaults = listOf(
        listOf("com.teamsmart.videomanager.tv", "com.liskovsoft.smarttubetv.beta", "com.liskovsoft.smarttubetv") to "smarttube",
        listOf("org.xbmc.kodi") to "kodi",
        emptyList<String>() to "tuner",
        listOf("com.qobuz.music", "com.qobuz.android.tv") to "qobuz",
    )

    fun favourites(apps: List<AppEntry>): List<String> {
        val saved = p.getString("favs", null)
        if (saved != null) {
            val installed = apps.map { it.pkg }.toSet()
            return saved.split(',').filter { it.isNotBlank() && it in installed }
        }
        return defaults.mapNotNull { (pkgs, hint) ->
            pkgs.firstOrNull { pk -> apps.any { it.pkg == pk } }
                ?: apps.firstOrNull { it.label.lowercase() == hint }?.pkg
                ?: apps.firstOrNull { it.label.lowercase().replace(" ", "").contains(hint) }?.pkg
        }.distinct()
    }

    fun setFavourites(list: List<String>) = p.edit().putString("favs", list.joinToString(",")).apply()

    var hidden: Set<String>
        get() = p.getStringSet("hidden", emptySet())!!.toSet()
        set(v) = p.edit().putStringSet("hidden", v).apply()

    /** "aerial" (video), "still" (one real aerial frame) or "plain" (gradient) */
    var background: String
        get() = p.getString("bg", "aerial")!!
        set(v) = p.edit().putString("bg", v).apply()

    /** "1080" (H.264, lightest) or "4k" (HEVC) */
    var quality: String
        get() = p.getString("quality", "1080")!!
        set(v) = p.edit().putString("quality", v).apply()

    /** "system", "24" or "12" */
    var clock: String
        get() = p.getString("clock", "system")!!
        set(v) = p.edit().putString("clock", v).apply()

    /**
     * Hours the home screen keeps the TV awake with no input, so the system screensaver doesn't
     * cover Drift's own aerial. 0 = never (the system screensaver behaves as normal).
     * Other apps are unaffected: their screensaver/sleep still works.
     */
    var stayOnHours: Int
        get() = p.getInt("stayon", 4)
        set(v) = p.edit().putInt("stayon", v).apply()

    /** The first-run home screen wizard has been shown (or dismissed). */
    var setupSeen: Boolean
        get() = p.getBoolean("setup_seen", false)
        set(v) = p.edit().putBoolean("setup_seen", v).apply()

    /** What the screen fades to: "aerial", "dim_music" (near-black + faint now playing while music plays) or "dim". */
    var fadeTo: String
        get() = p.getString("fadeto", "aerial")!!
        set(v) = p.edit().putString("fadeto", v).apply()

    /** Seconds of no input before the UI fades away and only the aerial remains. 0 = never. */
    var ambientSeconds: Int
        get() = p.getInt("ambient", 45)
        set(v) = p.edit().putInt("ambient", v).apply()

    /** Slowly move the clock and info text so nothing sits on the same OLED pixels for long. */
    var burnIn: Boolean
        get() = p.getBoolean("burnin", true)
        set(v) = p.edit().putBoolean("burnin", v).apply()

    /** "modern", "geometric" or "serif" (see Fonts) */
    var font: String
        get() = p.getString("font", "modern")!!
        set(v) = p.edit().putString("font", v).apply()

    /** "any" (whatever is playing), "qobuz" or "off" */
    var nowPlaying: String
        get() = p.getString("nowplaying", "any")!!
        set(v) = p.edit().putString("nowplaying", v).apply()

    var manifest: String?
        get() = p.getString("manifest2", null)
        set(v) = p.edit().putString("manifest2", v).putLong("manifest_ts", System.currentTimeMillis()).apply()

    val manifestAgeMs: Long get() = System.currentTimeMillis() - p.getLong("manifest_ts", 0)
}

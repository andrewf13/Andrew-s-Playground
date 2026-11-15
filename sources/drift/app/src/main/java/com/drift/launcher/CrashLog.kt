package com.drift.launcher

import android.content.Context

/**
 * Keeps the last uncaught crash so it can be read on the TV (bottom of Drift's Settings) without
 * adb/logcat. Written synchronously because the process is about to die.
 */
object CrashLog {
    private var installed = false

    fun install(ctx: Context) {
        if (installed) return
        installed = true
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            runCatching {
                val where = e.stackTrace.firstOrNull { it.className.startsWith("com.drift") } ?: e.stackTrace.firstOrNull()
                val line = "${e.javaClass.simpleName}: ${e.message?.take(120)} @ ${where?.fileName}:${where?.lineNumber} (${t.name})"
                ctx.getSharedPreferences("drift", Context.MODE_PRIVATE).edit()
                    .putString("crash", line).putLong("crash_ver", version(ctx)).putLong("crash_ts", System.currentTimeMillis()).commit()
            }
            previous?.uncaughtException(t, e)
        }
    }

    private fun version(ctx: Context): Long =
        runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).longVersionCode }.getOrDefault(0L)

    /** The last crash in the past week from the version that's installed now, or null. */
    fun last(ctx: Context): String? {
        val p = ctx.getSharedPreferences("drift", Context.MODE_PRIVATE)
        if (System.currentTimeMillis() - p.getLong("crash_ts", 0) > 7L * 24 * 3600 * 1000) return null
        if (p.getLong("crash_ver", -1) != version(ctx)) return null   // fixed in an update: don't keep showing it
        return p.getString("crash", null)
    }
}

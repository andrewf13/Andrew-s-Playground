package com.drift.launcher

import android.content.Context
import android.graphics.Typeface

/**
 * Three type styles for the clock, date, location and now-playing text. App names and menus stay in
 * the system font so the UI reads consistently.
 *
 *  - modern:    Roboto Thin (built into Android, nothing bundled)
 *  - geometric: Outfit, a light geometric sans (OFL, bundled, Latin subset)
 *  - serif:     Fraunces, a soft high-contrast display serif (OFL, bundled, Latin subset)
 */
object Fonts {
    val styles = listOf("modern", "geometric", "serif")
    val names = mapOf("modern" to "Modern", "geometric" to "Geometric", "serif" to "Serif")

    class Set(val clock: Typeface, val label: Typeface, val text: Typeface, val clockSpacing: Float, val clockSp: Float)

    private val cache = HashMap<String, Set>()

    fun get(ctx: Context, style: String): Set = cache.getOrPut(style) {
        when (style) {
            "geometric" -> Set(
                clock = variable(ctx, "fonts/outfit.ttf", "'wght' 130"),
                label = variable(ctx, "fonts/outfit.ttf", "'wght' 500"),
                text = variable(ctx, "fonts/outfit.ttf", "'wght' 400"),
                clockSpacing = -0.03f, clockSp = 80f,
            )
            "serif" -> Set(
                clock = variable(ctx, "fonts/fraunces.ttf", "'opsz' 144, 'wght' 250, 'SOFT' 100, 'WONK' 0"),
                label = variable(ctx, "fonts/fraunces.ttf", "'opsz' 12, 'wght' 560, 'SOFT' 50, 'WONK' 0"),
                text = variable(ctx, "fonts/fraunces.ttf", "'opsz' 24, 'wght' 400, 'SOFT' 50, 'WONK' 0"),
                clockSpacing = -0.01f, clockSp = 78f,
            )
            else -> Set(
                clock = Typeface.create("sans-serif-thin", Typeface.NORMAL),
                label = Typeface.create("sans-serif-medium", Typeface.NORMAL),
                text = Typeface.create("sans-serif", Typeface.NORMAL),
                clockSpacing = -0.02f, clockSp = 76f,
            )
        }
    }

    private fun variable(ctx: Context, asset: String, axes: String): Typeface =
        runCatching { Typeface.Builder(ctx.assets, asset).setFontVariationSettings(axes).build() }
            .getOrNull() ?: Typeface.create("sans-serif-light", Typeface.NORMAL)
}

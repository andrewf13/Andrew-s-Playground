package com.drift.launcher

import android.content.Context
import android.content.Intent
import android.media.tv.TvContract
import android.media.tv.TvInputInfo
import android.media.tv.TvInputManager

/**
 * TV sources (HDMI etc.) as launchable entries, the same list the remote's Source button shows.
 * Only TVs have these (e.g. Sony Bravia); on the Shield or a Chromecast the list is empty.
 *
 * Entries use the key "input:<inputId>" so favourites, hiding and All apps treat them like apps.
 */
object Inputs {
    const val PREFIX = "input:"

    fun isInput(key: String) = key.startsWith(PREFIX)

    fun load(ctx: Context): List<AppEntry> {
        val tim = ctx.getSystemService(TvInputManager::class.java) ?: return emptyList()
        val all = runCatching { tim.tvInputList }.getOrNull().orEmpty()
        val fallbackIcon = ctx.getDrawable(R.drawable.ic_input)!!
        // HDMI-CEC devices (a Shield, a Switch) appear as child inputs of the port they're plugged into.
        val children = all.filter { it.parentId != null }.groupBy { it.parentId }
        return all.filter { it.isPassthroughInput && it.parentId == null && it.type != TvInputInfo.TYPE_TUNER }
            .filter { runCatching { !it.isHidden(ctx) }.getOrDefault(true) }   // hidden in the TV's own settings
            .map { port ->
                val portName = name(ctx, port)
                val device = children[port.id]?.firstOrNull()?.let { name(ctx, it) }
                val label = if (device != null && !device.equals(portName, true)) "$device · $portName" else portName
                val state = runCatching { tim.getInputState(port.id) }.getOrDefault(TvInputManager.INPUT_STATE_CONNECTED)
                val icon = runCatching { port.loadIcon(ctx) }.getOrNull() ?: fallbackIcon
                AppEntry(PREFIX + port.id, label, null, icon,
                    dim = device == null && state == TvInputManager.INPUT_STATE_DISCONNECTED)
            }
    }

    private fun name(ctx: Context, i: TvInputInfo): String =
        (runCatching { i.loadCustomLabel(ctx) }.getOrNull()?.toString()?.takeIf { it.isNotBlank() }
            ?: i.loadLabel(ctx).toString()).trim()

    /** Switch the TV to that source (handled by the TV's own Live TV app). */
    fun intent(key: String): Intent =
        Intent(Intent.ACTION_VIEW, TvContract.buildChannelUriForPassthroughInput(key.removePrefix(PREFIX)))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}

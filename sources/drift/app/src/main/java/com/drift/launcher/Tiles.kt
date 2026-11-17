package com.drift.launcher

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewOutlineProvider
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView

fun Context.dp(v: Float): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()
fun Context.dp(v: Int): Int = dp(v.toFloat())

private val ease = DecelerateInterpolator(2.2f)

/**
 * A rounded 16:9 card. Shows the app's TV banner when it has one; otherwise the icon on a frosted
 * card with the name, so phone-style apps still look deliberate.
 */
@SuppressLint("ViewConstructor")
class Tile(
    ctx: Context,
    val key: String,
    val label: String,
    banner: Drawable?,
    icon: Drawable?,
    w: Int,
    h: Int,
    private val focusScale: Float,
    glyph: Boolean = false,
    /** Brightness when not focused; hidden apps in All apps use a much dimmer value. */
    private val restAlpha: Float = 0.78f,
) : FrameLayout(ctx) {

    private val radius = ctx.dp(if (h > ctx.dp(90)) 14 else 10).toFloat()
    private val ring = GradientDrawable().apply {
        cornerRadius = radius
        setStroke(ctx.dp(2.5f), Color.WHITE)
        setColor(Color.TRANSPARENT)
        alpha = 0
    }
    var lifted = false
        set(v) { field = v; animateTo(hasFocus() || v) }

    init {
        layoutParams = MarginLayoutParams(w, h)
        isFocusable = true
        isClickable = true
        isLongClickable = true
        clipToOutline = true
        outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) = outline.setRoundRect(0, 0, view.width, view.height, radius)
        }
        foreground = ring
        alpha = restAlpha

        if (banner != null) {
            addView(ImageView(ctx).apply { setImageDrawable(banner); scaleType = ImageView.ScaleType.CENTER_CROP },
                LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        } else {
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(0x4DFFFFFF, 0x1AFFFFFF)).apply { cornerRadius = radius }
            val iconSize = (h * if (glyph) 0.30f else 0.42f).toInt()
            addView(ImageView(ctx).apply { setImageDrawable(icon); scaleType = ImageView.ScaleType.FIT_CENTER },
                LayoutParams(iconSize, iconSize, Gravity.CENTER).apply { bottomMargin = if (glyph) 0 else h / 9 })
            if (!glyph) addView(TextView(ctx).apply {
                text = label
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_PX, h * 0.12f)
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                maxLines = 1; ellipsize = TextUtils.TruncateAt.END
                gravity = Gravity.CENTER
            }, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply {
                bottomMargin = h / 10; leftMargin = h / 10; rightMargin = h / 10
            })
        }
    }

    override fun onFocusChanged(gainFocus: Boolean, direction: Int, previouslyFocusedRect: android.graphics.Rect?) {
        super.onFocusChanged(gainFocus, direction, previouslyFocusedRect)
        animateTo(gainFocus || lifted)
    }

    private fun animateTo(on: Boolean) {
        val s = if (lifted) focusScale + 0.06f else if (on) focusScale else 1f
        animate().scaleX(s).scaleY(s).alpha(if (on) 1f else restAlpha)
            .translationZ(if (on) context.dp(14).toFloat() else 0f)
            .translationY(if (lifted) -context.dp(8).toFloat() else 0f)
            .setDuration(170).setInterpolator(ease).start()
        ring.alpha = if (on) 255 else 0
    }
}

/** Focusable text row used in the sheets (settings, app options). */
fun Context.sheetRow(title: String, value: String? = null): FrameLayout {
    val r = dp(12).toFloat()
    val bg = StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_focused), GradientDrawable().apply { cornerRadius = r; setColor(Color.WHITE) })
        addState(intArrayOf(), GradientDrawable().apply { cornerRadius = r; setColor(Color.TRANSPARENT) })
    }
    val row = FrameLayout(this).apply {
        background = bg
        isFocusable = true; isClickable = true
        setPadding(dp(18), dp(12), dp(18), dp(12))
    }
    val t = TextView(this).apply {
        text = title; tag = "title"
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
    row.addView(t, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.START or Gravity.CENTER_VERTICAL))
    val v = TextView(this).apply {
        text = value ?: ""; tag = "value"
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        visibility = if (value == null) View.GONE else View.VISIBLE
    }
    row.addView(v, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.END or Gravity.CENTER_VERTICAL))
    val paint = { focused: Boolean ->
        t.setTextColor(if (focused) 0xFF0B0F17.toInt() else Color.WHITE)
        v.setTextColor(if (focused) 0xB30B0F17.toInt() else 0x99FFFFFF.toInt())
    }
    paint(false)
    row.setOnFocusChangeListener { _, f -> paint(f) }
    return row
}

fun FrameLayout.setRowValue(v: String) { (findViewWithTag<TextView>("value"))?.text = v }

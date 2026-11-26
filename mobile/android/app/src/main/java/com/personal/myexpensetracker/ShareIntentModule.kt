package com.personal.myexpensetracker

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream

class ShareIntentModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    activeReactContext = reactContext
  }

  override fun getName(): String = "ShareIntentModule"

  @ReactMethod
  fun getInitialSharedImage(promise: Promise) {
    val uri = pendingSharedUri
    pendingSharedUri = null
    promise.resolve(uri)
  }

  @ReactMethod
  fun clearSharedImage() {
    pendingSharedUri = null
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter
  }

  companion object {
    @Volatile
    private var pendingSharedUri: String? = null

    @Volatile
    private var activeReactContext: ReactApplicationContext? = null

    fun handleIntent(context: Context, intent: Intent?) {
      if (intent == null) return
      if (Intent.ACTION_SEND != intent.action) return
      val mimeType = intent.type ?: ""
      if (!mimeType.startsWith("image/") && mimeType.isNotEmpty()) return

      val streamUri: Uri? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_STREAM)
      }
      if (streamUri == null) return

      val cachedFileUri = copyToCache(context, streamUri, mimeType) ?: return
      pendingSharedUri = cachedFileUri

      val ctx = activeReactContext
      if (ctx != null && ctx.hasActiveReactInstance()) {
        ctx
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("ArthlySharedImage", cachedFileUri)
      }
    }

    private fun copyToCache(context: Context, uri: Uri, mimeType: String): String? {
      return try {
        val ext = when {
          mimeType.contains("png", ignoreCase = true) -> "png"
          mimeType.contains("webp", ignoreCase = true) -> "webp"
          else -> "jpg"
        }
        val outFile = File(context.cacheDir, "arthly_shared_${System.currentTimeMillis()}.$ext")
        context.contentResolver.openInputStream(uri)?.use { input ->
          FileOutputStream(outFile).use { output ->
            input.copyTo(output)
          }
        }
        Uri.fromFile(outFile).toString()
      } catch (_: Exception) {
        null
      }
    }
  }
}

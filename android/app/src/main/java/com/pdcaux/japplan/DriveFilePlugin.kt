package com.pdcaux.japplan

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import android.util.Base64
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException

@CapacitorPlugin(name = "DriveFile")
class DriveFilePlugin : Plugin() {

    // Kept open across readRange() calls for the same URI — reopening a ParcelFileDescriptor
    // (SAF/Binder round-trip) for every tile read would make map panning noticeably laggy.
    private var rangeReadUri: String? = null
    private var rangeReadPfd: ParcelFileDescriptor? = null
    private var rangeReadStream: FileInputStream? = null

    @PluginMethod
    fun pickFile(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }
        startActivityForResult(call, intent, "handlePickFile")
    }

    @ActivityCallback
    private fun handlePickFile(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("PICK_CANCELLED")
            return
        }
        val uri = result.data?.data
        if (uri == null) {
            call.reject("PICK_CANCELLED")
            return
        }

        context.contentResolver.takePersistableUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )

        val ret = JSObject()
        ret.put("uri", uri.toString())
        ret.put("name", queryDisplayName(uri) ?: uri.lastPathSegment ?: "activities.json")
        call.resolve(ret)
    }

    @PluginMethod
    fun hasPersistedAccess(call: PluginCall) {
        val uriString = call.getString("uri") ?: return call.reject("MISSING_URI")
        val granted = context.contentResolver.persistedUriPermissions.any {
            it.uri.toString() == uriString && it.isReadPermission && it.isWritePermission
        }
        val ret = JSObject()
        ret.put("granted", granted)
        call.resolve(ret)
    }

    @PluginMethod
    fun readText(call: PluginCall) {
        val uriString = call.getString("uri") ?: return call.reject("MISSING_URI")
        try {
            val content = context.contentResolver.openInputStream(Uri.parse(uriString))?.use { stream ->
                stream.readBytes().toString(Charsets.UTF_8)
            } ?: return call.reject("READ_FAILED")

            val ret = JSObject()
            ret.put("content", content)
            call.resolve(ret)
        } catch (e: SecurityException) {
            call.reject("ACCESS_REVOKED", e)
        } catch (e: IOException) {
            call.reject("READ_FAILED", e)
        }
    }

    @PluginMethod
    fun writeText(call: PluginCall) {
        val uriString = call.getString("uri") ?: return call.reject("MISSING_URI")
        val content = call.getString("content") ?: return call.reject("MISSING_CONTENT")
        try {
            val bytes = content.toByteArray(Charsets.UTF_8)
            // Mode "wt" alone is not enough — Google Drive's DocumentsProvider has been observed
            // to ignore the truncate flag, leaving trailing bytes from a previous, longer write
            // appended after the new content. Explicitly truncating the file descriptor's channel
            // to the exact byte length written guarantees no leftover bytes regardless of the
            // provider's own truncate support.
            val pfd = context.contentResolver.openFileDescriptor(Uri.parse(uriString), "rwt")
                ?: return call.reject("WRITE_FAILED")
            pfd.use {
                FileOutputStream(it.fileDescriptor).use { stream ->
                    stream.write(bytes)
                    stream.channel.truncate(bytes.size.toLong())
                }
            }
            call.resolve()
        } catch (e: SecurityException) {
            call.reject("ACCESS_REVOKED", e)
        } catch (e: IOException) {
            call.reject("WRITE_FAILED", e)
        }
    }

    @PluginMethod
    fun readRange(call: PluginCall) {
        val uriString = call.getString("uri") ?: return call.reject("MISSING_URI")
        // getLong() returns null for a JS `0` (Capacitor/org.json stores small whole
        // numbers as Integer, not Long, and getLong() doesn't coerce) — getDouble()
        // handles any JS number reliably, including 0, up to far more than any
        // realistic file offset.
        val offset = call.getDouble("offset")?.toLong() ?: return call.reject("MISSING_OFFSET")
        val length = call.getInt("length") ?: return call.reject("MISSING_LENGTH")
        try {
            val stream = openRangeReadStream(uriString)
            stream.channel.position(offset)
            val buffer = ByteArray(length)
            var totalRead = 0
            while (totalRead < length) {
                val read = stream.read(buffer, totalRead, length - totalRead)
                if (read == -1) break
                totalRead += read
            }
            val data = if (totalRead == length) buffer else buffer.copyOf(totalRead)
            val ret = JSObject()
            ret.put("dataBase64", Base64.encodeToString(data, Base64.NO_WRAP))
            call.resolve(ret)
        } catch (e: SecurityException) {
            closeRangeReadStream()
            call.reject("ACCESS_REVOKED: ${e.message}", e)
        } catch (e: IOException) {
            closeRangeReadStream()
            call.reject("READ_FAILED: ${e.message}", e)
        }
    }

    @PluginMethod
    fun closeRangeRead(call: PluginCall) {
        closeRangeReadStream()
        call.resolve()
    }

    override fun handleOnDestroy() {
        closeRangeReadStream()
        super.handleOnDestroy()
    }

    private fun openRangeReadStream(uriString: String): FileInputStream {
        val existing = rangeReadStream
        if (existing != null && rangeReadUri == uriString) return existing

        closeRangeReadStream()
        val pfd = context.contentResolver.openFileDescriptor(Uri.parse(uriString), "r")
            ?: throw IOException("OPEN_FAILED")
        val stream = FileInputStream(pfd.fileDescriptor)
        rangeReadPfd = pfd
        rangeReadStream = stream
        rangeReadUri = uriString
        return stream
    }

    private fun closeRangeReadStream() {
        try {
            rangeReadStream?.close()
        } catch (e: IOException) {
            // best-effort close
        }
        try {
            rangeReadPfd?.close()
        } catch (e: IOException) {
            // best-effort close
        }
        rangeReadStream = null
        rangeReadPfd = null
        rangeReadUri = null
    }

    private fun queryDisplayName(uri: Uri): String? {
        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(uri, null, null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0) return cursor.getString(index)
            }
        } finally {
            cursor?.close()
        }
        return null
    }
}

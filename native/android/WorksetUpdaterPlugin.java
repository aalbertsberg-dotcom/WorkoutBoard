package com.workset.mobile;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Point;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "WorksetUpdater")
public class WorksetUpdaterPlugin extends Plugin {
    private static final String MIME = "application/vnd.android.package-archive";
    private static final Pattern TRUSTED = Pattern.compile(
        "^https://github\\.com/aalbertsberg-dotcom/WorkoutBoard/releases/download/android-v([1-9][0-9]{0,8})/WorkSet\\.apk$"
    );
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getSystemInsets(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                View content = getActivity().findViewById(android.R.id.content);
                WindowInsets insets = content.getRootWindowInsets();
                int bottomPx = 0;
                if (insets != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        bottomPx = insets.getInsets(WindowInsets.Type.navigationBars()).bottom;
                    } else {
                        bottomPx = insets.getSystemWindowInsetBottom();
                    }
                }
                // Only offset the HTML bar when WebView really extends behind
                // the system navigation area. Otherwise this would double-pad.
                Point real = new Point();
                getActivity().getWindowManager().getDefaultDisplay().getRealSize(real);
                int[] location = new int[2];
                content.getLocationOnScreen(location);
                int overlap = location[1] + content.getHeight() > real.y - bottomPx + 2 ? bottomPx : 0;
                float density = getContext().getResources().getDisplayMetrics().density;
                JSObject result = new JSObject();
                result.put("bottom", overlap / Math.max(density, 0.1f));
                result.put("systemBottom", bottomPx / Math.max(density, 0.1f));
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Cannot read Android navigation insets.");
            }
        });
    }

    private long installedBuild() throws Exception {
        PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return info.getLongVersionCode();
        return info.versionCode;
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String address = call.getString("url", "");
        String checksum = call.getString("sha256", "");
        int requested = call.getInt("versionCode", 0);
        Matcher match = TRUSTED.matcher(address);
        if (!match.matches() || !checksum.matches("(?i)^[a-f0-9]{64}$")) {
            call.reject("Untrusted APK URL or missing SHA-256 checksum.");
            return;
        }
        try {
            long advertised = Long.parseLong(match.group(1));
            if (advertised != requested || advertised <= installedBuild()) {
                call.reject("This APK is not a newer WorkSet release.");
                return;
            }
        } catch (Exception e) {
            call.reject("Invalid Android release version.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(settings);
                JSObject result = new JSObject();
                result.put("status", "permission-required");
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Allow this app to install updates in Android settings.");
            }
            return;
        }

        worker.execute(() -> {
            File apk = null;
            try {
                File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (directory == null) throw new Exception("Android storage unavailable.");
                if (!directory.exists() && !directory.mkdirs()) throw new Exception("Cannot prepare app storage.");
                apk = new File(directory, "WorkSet.apk");
                if (apk.exists() && !apk.delete()) throw new Exception("Cannot replace previous download.");
                DownloadManager manager=(DownloadManager)getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                if (manager == null) throw new Exception("Android download service unavailable.");
                DownloadManager.Request request=new DownloadManager.Request(Uri.parse(address));
                request.setTitle("WorkSet APK update");
                request.setDescription("Verified signed update for WorkSet");
                request.setMimeType(MIME);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalFilesDir(getContext(),Environment.DIRECTORY_DOWNLOADS,"WorkSet.apk");
                long id=manager.enqueue(request);
                boolean complete=false;
                long deadline=System.currentTimeMillis()+8*60*1000L;
                int lastPercent=-1;
                while (System.currentTimeMillis()<deadline) {
                    try (android.database.Cursor cursor=manager.query(
                        new DownloadManager.Query().setFilterById(id))) {
                        if(cursor==null || !cursor.moveToFirst())throw new Exception("Update download disappeared.");
                        int status=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                        if(status==DownloadManager.STATUS_FAILED)
                            throw new Exception("Android could not download the update.");
                        if(status==DownloadManager.STATUS_SUCCESSFUL){ complete=true;break; }
                        long done=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                        long total=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                        int percent=total>0?(int)Math.min(99,100*done/total):0;
                        if(percent!=lastPercent) {
                            lastPercent=percent;
                            JSObject progress=new JSObject();
                            progress.put("percent",percent);
                            notifyListeners("downloadProgress",progress);
                        }
                    }
                    Thread.sleep(850);
                }
                if(!complete)throw new Exception("The APK download timed out.");
                if(!apk.isFile()||apk.length()<1000000)throw new Exception("Downloaded APK is incomplete.");
                String actual=sha256(apk);
                if(!actual.equals(checksum.toLowerCase(Locale.US)))
                    throw new Exception("APK checksum mismatch. Update was not opened.");
                File finalApk=apk;
                getActivity().runOnUiThread(() -> {
                    try {
                        Uri uri=FileProvider.getUriForFile(getContext(),
                            getContext().getPackageName()+".worksetupdates",finalApk);
                        Intent intent=new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri,MIME);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getActivity().startActivity(intent);
                        JSObject result=new JSObject();
                        result.put("status","installer-opened");
                        call.resolve(result);
                    }catch(Exception e){
                        call.reject("Could not open Android's package installer.");
                    }
                });
            }catch(Exception e){
                if(apk!=null && apk.exists())apk.delete();
                call.reject(e.getMessage()==null?"APK update failed.":e.getMessage());
            }
        });
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(FileInputStream input=new FileInputStream(file)) {
            byte[] buffer=new byte[65536];
            int count;
            while((count=input.read(buffer))!=-1)digest.update(buffer,0,count);
        }
        StringBuilder hex=new StringBuilder();
        for(byte value:digest.digest())hex.append(String.format(Locale.US,"%02x",value&0xff));
        return hex.toString();
    }
}

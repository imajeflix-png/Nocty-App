import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const capConfigPath = path.resolve(rootDir, 'capacitor.config.json');

let appId = 'com.nocty.music';
if (fs.existsSync(capConfigPath)) {
  try {
    const capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));
    if (capConfig?.appId && typeof capConfig.appId === 'string') {
      appId = capConfig.appId.trim();
    }
  } catch {
    // Fallback to default appId
  }
}

const packageSegments = appId.split('.');
const javaPackageDir = path.resolve(rootDir, 'android/app/src/main/java', ...packageSegments);

if (!fs.existsSync(javaPackageDir)) {
  console.error(
    `[Nocty Dynamic Island] Direktori Java tidak ditemukan di: ${javaPackageDir}\n` +
      'Jalankan "npx cap add android" terlebih dahulu sebelum menjalankan skrip ini.'
  );
  process.exit(1);
}

const dynamicIslandPluginJava = `package ${appId};

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "DynamicIsland")
public class DynamicIslandPlugin extends Plugin {

    private static final String PREFS_NAME = "nocty_overlay_prefs";
    private static final String KEY_OVERLAY_PROMPTED = "overlay_prompted_once";
    private static WeakReference<DynamicIslandPlugin> instanceRef = new WeakReference<>(null);

    @Override
    public void load() {
        super.load();
        instanceRef = new WeakReference<>(this);
    }

    public static void dispatchAction(String action) {
        DynamicIslandPlugin plugin = instanceRef.get();
        if (plugin != null) {
            JSObject payload = new JSObject();
            payload.put("action", action);
            plugin.notifyListeners("islandAction", payload, true);
        }
    }

    @PluginMethod
    public void updateState(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context unavailable");
            return;
        }

        String title = call.getString("title", "Nocty");
        String artist = call.getString("artist", "Nocty Music");
        boolean isPlaying = Boolean.TRUE.equals(call.getBoolean("isPlaying", false));
        String artwork = call.getString("artwork", "");

        if (isPlaying && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            promptOverlayPermissionOnce(context);
        }

        Intent serviceIntent = new Intent(context, DynamicIslandOverlayService.class);
        serviceIntent.setAction(DynamicIslandOverlayService.ACTION_UPDATE_STATE);
        serviceIntent.putExtra(DynamicIslandOverlayService.EXTRA_TITLE, title);
        serviceIntent.putExtra(DynamicIslandOverlayService.EXTRA_ARTIST, artist);
        serviceIntent.putExtra(DynamicIslandOverlayService.EXTRA_IS_PLAYING, isPlaying);
        serviceIntent.putExtra(DynamicIslandOverlayService.EXTRA_ARTWORK, artwork);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception ignored) {
            // Avoid foreground-start crash if OS restricts background launch
        }

        JSObject ret = new JSObject();
        ret.put("canDrawOverlays", Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context));
        call.resolve(ret);
    }

    @PluginMethod
    public void hide(PluginCall call) {
        Context context = getContext();
        if (context != null) {
            Intent stopIntent = new Intent(context, DynamicIslandOverlayService.class);
            stopIntent.setAction(DynamicIslandOverlayService.ACTION_STOP);
            try {
                context.startService(stopIntent);
            } catch (Exception ignored) {
                context.stopService(new Intent(context, DynamicIslandOverlayService.class));
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        Context context = getContext();
        boolean granted = context != null && (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context));
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Context context = getContext();
        if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            openOverlaySettings(context);
        }
        call.resolve();
    }

    private void promptOverlayPermissionOnce(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean alreadyPrompted = prefs.getBoolean(KEY_OVERLAY_PROMPTED, false);
        if (alreadyPrompted) {
            return;
        }
        prefs.edit().putBoolean(KEY_OVERLAY_PROMPTED, true).apply();
        openOverlaySettings(context);
    }

    private void openOverlaySettings(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + context.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception ignored) {
                // Fallback safely on OEM ROMs without standard overlay intent
            }
        }
    }
}
`;

const dynamicIslandOverlayServiceJava = `package ${appId};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DynamicIslandOverlayService extends Service {

    public static final String ACTION_UPDATE_STATE = "com.nocty.music.ACTION_UPDATE_STATE";
    public static final String ACTION_TOGGLE_PLAY = "com.nocty.music.ACTION_TOGGLE_PLAY";
    public static final String ACTION_NEXT = "com.nocty.music.ACTION_NEXT";
    public static final String ACTION_PREV = "com.nocty.music.ACTION_PREV";
    public static final String ACTION_STOP = "com.nocty.music.ACTION_STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_ARTWORK = "artwork";

    private static final String CHANNEL_ID = "nocty_media_playback";
    private static final int NOTIFICATION_ID = 7701;

    private WindowManager windowManager;
    private View overlayView;
    private ImageView artImageView;
    private TextView titleTextView;
    private TextView artistTextView;
    private ImageButton playPauseButton;

    private MediaSession mediaSession;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService imageExecutor = Executors.newSingleThreadExecutor();

    private String currentTitle = "Nocty";
    private String currentArtist = "Nocty Music";
    private boolean currentIsPlaying = false;
    private String currentArtworkUrl = "";
    private Bitmap currentArtworkBitmap = null;

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        ensureNotificationChannel();
        initMediaSession();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            removeOverlay();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_TOGGLE_PLAY.equals(action)) {
            DynamicIslandPlugin.dispatchAction("togglePlay");
            return START_STICKY;
        }

        if (ACTION_NEXT.equals(action)) {
            DynamicIslandPlugin.dispatchAction("next");
            return START_STICKY;
        }

        if (ACTION_PREV.equals(action)) {
            DynamicIslandPlugin.dispatchAction("prev");
            return START_STICKY;
        }

        String newTitle = intent.getStringExtra(EXTRA_TITLE);
        String newArtist = intent.getStringExtra(EXTRA_ARTIST);
        boolean newIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, currentIsPlaying);
        String newArtwork = intent.getStringExtra(EXTRA_ARTWORK);

        if (newTitle != null && !newTitle.isEmpty()) currentTitle = newTitle;
        if (newArtist != null && !newArtist.isEmpty()) currentArtist = newArtist;
        currentIsPlaying = newIsPlaying;

        updateMediaSessionState();
        startOrUpdateForegroundNotification();
        ensureOrUpdateOverlay();

        if (newArtwork != null && !newArtwork.equals(currentArtworkUrl)) {
            currentArtworkUrl = newArtwork;
            loadArtworkAsync(newArtwork);
        }

        return START_STICKY;
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Pemutar Musik Nocty",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Kontrol musik Nocty & Dynamic Island");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSession(this, "NoctyMediaSession");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                DynamicIslandPlugin.dispatchAction("play");
            }

            @Override
            public void onPause() {
                DynamicIslandPlugin.dispatchAction("pause");
            }

            @Override
            public void onSkipToNext() {
                DynamicIslandPlugin.dispatchAction("next");
            }

            @Override
            public void onSkipToPrevious() {
                DynamicIslandPlugin.dispatchAction("prev");
            }
        });
        mediaSession.setActive(true);
    }

    private void updateMediaSessionState() {
        if (mediaSession == null) return;

        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS;

        PlaybackState state = new PlaybackState.Builder()
            .setActions(actions)
            .setState(
                currentIsPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                PlaybackState.PLAYBACK_POSITION_UNKNOWN,
                currentIsPlaying ? 1.0f : 0.0f
            )
            .build();
        mediaSession.setPlaybackState(state);

        MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist);
        if (currentArtworkBitmap != null) {
            metaBuilder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, currentArtworkBitmap);
        }
        mediaSession.setMetadata(metaBuilder.build());
    }

    private PendingIntent buildServiceActionIntent(String action, int requestCode) {
        Intent intent = new Intent(this, DynamicIslandOverlayService.class);
        intent.setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return PendingIntent.getForegroundService(this, requestCode, intent, flags);
        }
        return PendingIntent.getService(this, requestCode, intent, flags);
    }

    private PendingIntent buildOpenAppIntent() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent(this, MainActivity.class);
        }
        launchIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(this, 100, launchIntent, flags);
    }

    private void startOrUpdateForegroundNotification() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        Notification.Action prevAction = new Notification.Action.Builder(
            android.R.drawable.ic_media_previous,
            "Sebelumnya",
            buildServiceActionIntent(ACTION_PREV, 101)
        ).build();

        Notification.Action toggleAction = new Notification.Action.Builder(
            currentIsPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
            currentIsPlaying ? "Jeda" : "Putar",
            buildServiceActionIntent(ACTION_TOGGLE_PLAY, 102)
        ).build();

        Notification.Action nextAction = new Notification.Action.Builder(
            android.R.drawable.ic_media_next,
            "Berikutnya",
            buildServiceActionIntent(ACTION_NEXT, 103)
        ).build();

        Notification.MediaStyle mediaStyle = new Notification.MediaStyle()
            .setShowActionsInCompactView(0, 1, 2);
        if (mediaSession != null) {
            mediaStyle.setMediaSession(mediaSession.getSessionToken());
        }

        int smallIcon = getApplicationInfo().icon != 0
            ? getApplicationInfo().icon
            : android.R.drawable.ic_media_play;

        builder
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSmallIcon(smallIcon)
            .setContentIntent(buildOpenAppIntent())
            .setOngoing(currentIsPlaying)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(prevAction)
            .addAction(toggleAction)
            .addAction(nextAction)
            .setStyle(mediaStyle);

        if (currentArtworkBitmap != null) {
            builder.setLargeIcon(currentArtworkBitmap);
        }

        Notification notification = builder.build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void ensureOrUpdateOverlay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            removeOverlay();
            return;
        }

        if (overlayView == null) {
            createOverlayView();
        }

        if (titleTextView != null) {
            titleTextView.setText(currentTitle);
            titleTextView.setSelected(true);
        }
        if (artistTextView != null) {
            artistTextView.setText(currentArtist);
        }
        if (playPauseButton != null) {
            playPauseButton.setImageDrawable(
                new BitmapDrawable(getResources(), createTransportBitmap(currentIsPlaying, dp(16)))
            );
            playPauseButton.setContentDescription(currentIsPlaying ? "Jeda lagu" : "Putar lagu");
        }
        if (artImageView != null && currentArtworkBitmap != null) {
            artImageView.setImageBitmap(currentArtworkBitmap);
        }
    }

    private void createOverlayView() {
        if (windowManager == null) return;

        LinearLayout capsule = new LinearLayout(this);
        capsule.setOrientation(LinearLayout.HORIZONTAL);
        capsule.setGravity(Gravity.CENTER_VERTICAL);
        capsule.setPadding(dp(10), dp(6), dp(8), dp(6));

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(dp(24));
        bg.setColor(Color.parseColor("#F20B0B0D"));
        bg.setStroke(dp(1), Color.argb(54, 255, 255, 255));
        capsule.setBackground(bg);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            capsule.setElevation(dp(12));
        }

        capsule.setOnClickListener(v -> {
            Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (openIntent == null) {
                openIntent = new Intent(DynamicIslandOverlayService.this, MainActivity.class);
            }
            openIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            );
            startActivity(openIntent);
        });

        artImageView = new ImageView(this);
        artImageView.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable artBg = new GradientDrawable();
        artBg.setShape(GradientDrawable.OVAL);
        artBg.setColor(Color.parseColor("#1D1D24"));
        artImageView.setBackground(artBg);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            artImageView.setClipToOutline(true);
            artImageView.setOutlineProvider(new ViewOutlineProvider() {
                @Override
                public void getOutline(View view, Outline outline) {
                    outline.setOval(0, 0, view.getWidth(), view.getHeight());
                }
            });
        }
        LinearLayout.LayoutParams artParams = new LinearLayout.LayoutParams(dp(28), dp(28));
        artParams.setMarginEnd(dp(9));
        capsule.addView(artImageView, artParams);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);

        titleTextView = new TextView(this);
        titleTextView.setTextColor(Color.WHITE);
        titleTextView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        titleTextView.setTypeface(titleTextView.getTypeface(), android.graphics.Typeface.BOLD);
        titleTextView.setSingleLine(true);
        titleTextView.setEllipsize(TextUtils.TruncateAt.MARQUEE);
        titleTextView.setMarqueeRepeatLimit(-1);
        titleTextView.setSelected(true);
        textCol.addView(titleTextView);

        artistTextView = new TextView(this);
        artistTextView.setTextColor(Color.argb(178, 255, 255, 255));
        artistTextView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        artistTextView.setSingleLine(true);
        artistTextView.setEllipsize(TextUtils.TruncateAt.END);
        textCol.addView(artistTextView);

        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(dp(128), LinearLayout.LayoutParams.WRAP_CONTENT);
        textParams.setMarginEnd(dp(8));
        capsule.addView(textCol, textParams);

        playPauseButton = new ImageButton(this);
        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setShape(GradientDrawable.OVAL);
        btnBg.setColor(Color.argb(38, 255, 255, 255));
        playPauseButton.setBackground(btnBg);
        playPauseButton.setScaleType(ImageView.ScaleType.CENTER);
        playPauseButton.setPadding(0, 0, 0, 0);
        playPauseButton.setOnClickListener(v -> DynamicIslandPlugin.dispatchAction("togglePlay"));

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(dp(30), dp(30));
        capsule.addView(playPauseButton, btnParams);

        int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.y = dp(10);

        try {
            windowManager.addView(capsule, params);
            overlayView = capsule;
        } catch (Exception ignored) {
            overlayView = null;
        }
    }

    private void removeOverlay() {
        if (windowManager != null && overlayView != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {
                // Already detached
            }
            overlayView = null;
        }
    }

    private Bitmap createTransportBitmap(boolean isPlaying, int sizePx) {
        Bitmap bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.WHITE);
        paint.setStyle(Paint.Style.FILL);

        if (isPlaying) {
            float barW = sizePx * 0.22f;
            float gap = sizePx * 0.18f;
            float leftX = (sizePx - (barW * 2 + gap)) / 2f;
            float top = sizePx * 0.16f;
            float bottom = sizePx * 0.84f;
            canvas.drawRoundRect(leftX, top, leftX + barW, bottom, 2f, 2f, paint);
            canvas.drawRoundRect(leftX + barW + gap, top, leftX + barW * 2 + gap, bottom, 2f, 2f, paint);
        } else {
            Path triangle = new Path();
            float left = sizePx * 0.28f;
            float right = sizePx * 0.82f;
            float top = sizePx * 0.16f;
            float bottom = sizePx * 0.84f;
            triangle.moveTo(left, top);
            triangle.lineTo(right, sizePx * 0.5f);
            triangle.lineTo(left, bottom);
            triangle.close();
            canvas.drawPath(triangle, paint);
        }
        return bmp;
    }

    private void loadArtworkAsync(String source) {
        if (source == null || source.isEmpty()) return;
        imageExecutor.execute(() -> {
            Bitmap loaded = null;
            try {
                if (source.startsWith("data:image")) {
                    int commaIdx = source.indexOf(',');
                    if (commaIdx != -1) {
                        byte[] decoded = Base64.decode(source.substring(commaIdx + 1), Base64.DEFAULT);
                        loaded = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                    }
                } else if (source.startsWith("http://") || source.startsWith("https://")) {
                    HttpURLConnection conn = (HttpURLConnection) new URL(source).openConnection();
                    conn.setConnectTimeout(3500);
                    conn.setReadTimeout(3500);
                    conn.setDoInput(true);
                    conn.connect();
                    try (InputStream stream = conn.getInputStream()) {
                        loaded = BitmapFactory.decodeStream(stream);
                    }
                }
            } catch (Exception ignored) {
                loaded = null;
            }

            if (loaded != null) {
                final Bitmap finalBmp = loaded;
                mainHandler.post(() -> {
                    currentArtworkBitmap = finalBmp;
                    if (artImageView != null) {
                        artImageView.setImageBitmap(finalBmp);
                    }
                    updateMediaSessionState();
                    startOrUpdateForegroundNotification();
                });
            }
        });
    }

    private int dp(int value) {
        return Math.round(
            TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value,
                getResources().getDisplayMetrics()
            )
        );
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        removeOverlay();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        imageExecutor.shutdownNow();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
`;

fs.writeFileSync(path.join(javaPackageDir, 'DynamicIslandPlugin.java'), dynamicIslandPluginJava, 'utf8');
fs.writeFileSync(
  path.join(javaPackageDir, 'DynamicIslandOverlayService.java'),
  dynamicIslandOverlayServiceJava,
  'utf8'
);

const mainActivityPath = path.join(javaPackageDir, 'MainActivity.java');
if (fs.existsSync(mainActivityPath)) {
  let mainActivity = fs.readFileSync(mainActivityPath, 'utf8');
  if (!mainActivity.includes('DynamicIslandPlugin.class')) {
    const updatedMainActivity = `package ${appId};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DynamicIslandPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
    fs.writeFileSync(mainActivityPath, updatedMainActivity, 'utf8');
  }
}

console.log(`[Nocty Dynamic Island] Native Capacitor plugin & overlay service dibuat di: ${javaPackageDir}`);
console.log('  ✓ DynamicIslandPlugin.java');
console.log('  ✓ DynamicIslandOverlayService.java');
console.log('  ✓ MainActivity.java (registerPlugin(DynamicIslandPlugin.class))');

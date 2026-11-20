package com.narrativearchive.shell;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.widget.FrameLayout;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * NarrativeArchive 껍데기 앱: 폰 안의 실리태번(기본 http://127.0.0.1:8000)을 띄우기만 해요.
 *  - 상단바 · 하단바 색을 페이지가 알려 주는 색으로 칠해요 (theme-color · 페이지 바탕). 확장이 폰 화면 색을 거기에 적어요
 *  - 실리태번이 꺼져 있으면 Termux에 켜는 명령을 보내고, 켜질 때까지 기다렸다가 띄워요
 *  - 파일 고르기(사진 · 채팅 파일, 여러 장)는 안드로이드 파일 창으로
 *  - 캐릭터 폰을 열면(NAShell.phone(true)) 기기 상단바를 숨기고 하단 버튼 줄 밑까지 화면을 깔아요. 폰이 자기 상단바(노치)를 그려요
 *  - 화면(WebView)이 죽어도 앱은 안 꺼지고 다시 불러와요. 앱이 꺼지면 이유를 적어 두고 다음에 켤 때 보여줘요
 * 실리태번 데이터는 Termux 쪽에 그대로 있어요. 이 앱은 주소와 켜는 명령만 기억해요.
 */
public class MainActivity extends Activity {
    private static final int FILE_REQ = 1, PERM_REQ = 2;
    private static final String DEF_URL = "http://127.0.0.1:8000/";
    private static final String DEF_CMD = "cd ~/SillyTavern && ./start.sh";

    private WebView web;
    private FrameLayout root;
    private boolean phoneMode = false;
    private int barTop = Color.parseColor("#333333"), barBottom = Color.parseColor("#333333");
    private int imeBottom = 0, navBottom = 0;
    private final long[] gone = new long[3];
    private boolean cacheRetried = false;
    private SharedPreferences prefs;
    private ValueCallback<Uri[]> fileCb;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private boolean waiting = false;

    // 페이지에 넣는 작은 스크립트: theme-color와 페이지 바탕색이 바뀌면 앱에 알려요. 뒤로 가기는 열린 창부터 닫아요
    private static final String BRIDGE_JS =
        "(function(){if(window.__naShell)return;window.__naShell=1;document.documentElement.classList.add('na-shell');" +
        "var last='';function bg(e){if(!e)return'';var c=getComputedStyle(e).backgroundColor;return(!c||c==='transparent'||/rgba\\([^)]*,\\s*0\\)$/.test(c))?'':c;}" +
        "function send(){try{var m=document.querySelector('meta[name=\"theme-color\"]');var t=m?m.content:'';" +
        "var b=bg(document.body)||bg(document.documentElement)||t;var k=t+'|'+b;if(k!==last){last=k;NAShell.setBars(t||b,b||t);}}catch(e){}}" +
        "var q=0;function kick(){if(q)return;q=1;setTimeout(function(){q=0;send();},120);}" +
        // (페이지 전체를 지켜보면 실리태번이 켜질 때 만드는 수천 개 조각마다 불려서 느려졌어요: theme-color가 있는 head, html · body 바탕만)
        "var mo=new MutationObserver(kick);mo.observe(document.head,{subtree:true,childList:true,attributes:true,attributeFilter:['content']});" +
        "mo.observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});if(document.body)mo.observe(document.body,{attributes:true,attributeFilter:['style','class']});" +
        "setInterval(send,1500);send();" +
        "window.__naBack=function(){var p=document.getElementById('na_phl');if(p&&p.open){p.close();return 1;}" +
        "var d=[].slice.call(document.querySelectorAll('dialog[open]')).pop();if(d){var c=d.querySelector('.popup-button-cancel,.popup-button-close,.menu_button_cancel');if(c){c.click();}else{d.close();}return 1;}return 0;};})();";

    // 실리태번이 처음 켜지는 동안(#preloader가 있는 동안: 첫 로딩이 끝나면 실리태번이 지워요)엔 로딩 화면 · 배경만 보이게: 다른 확장 창이 그 위에 잠깐 그려졌다 사라지며 깜박였어요(음악 확장)
    private static final String GUARD_JS =
        "(function(){if(!/^http/.test(location.href)||!document.documentElement)return 0;if(document.getElementById('na_guard'))return 1;" +
        "var s=document.createElement('style');s.id='na_guard';s.textContent='body:has(> #preloader) > :not(#preloader, #bg1, #bg_custom, :has(#loader)) { visibility: hidden !important; }';" +
        "(document.head||document.documentElement).appendChild(s);return 1;})()";

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs = getSharedPreferences("shell", MODE_PRIVATE);
        catchCrashes();
        if (Build.VERSION.SDK_INT >= 28) getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        root = new FrameLayout(this);
        setContentView(root);
        // 폰을 연 동안: 키보드가 올라온 만큼 화면을 줄이고, 하단 버튼 줄 높이를 페이지에 알려요(--na-nb)
        if (Build.VERSION.SDK_INT >= 30) root.setOnApplyWindowInsetsListener((v, ins) -> {
            imeBottom = ins.getInsets(WindowInsets.Type.ime()).bottom;
            navBottom = ins.getInsets(WindowInsets.Type.navigationBars()).bottom;
            fitPhone();
            return ins;
        });
        makeWeb();
        setBars(barTop, barBottom);
        showLastCrash();
        // (예전 페이지를 되살리지 않아요: 되살리면 "ERR_CACHE_MISS"가 떴어요. 늘 새로 열어요)
        open();
    }

    // ---- 화면(WebView): 죽으면 새로 만들어요
    private void makeWeb() {
        if (web != null) { root.removeView(web); try { web.destroy(); } catch (Exception e) { /* 이미 죽었어요 */ } }
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // (파일 창이 위에 떠 있어도 화면을 쉽게 죽이지 말라고 알려요)
        web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        web.addJavascriptInterface(new Bridge(), "NAShell");
        web.setWebViewClient(new WebViewClient() {
            // (새 페이지가 막 시작됐을 땐 문서가 아직 없을 수 있어서, 처음 1.5초 동안 몇 번 넣어 봐요. 이미 있으면 그대로)
            @Override public void onPageStarted(WebView v, String url, android.graphics.Bitmap icon) { if (url != null && url.startsWith("http")) guard(v, 0); }
            @Override public void onPageFinished(WebView v, String url) { if (url != null && url.startsWith("http")) { cacheRetried = false; v.evaluateJavascript(GUARD_JS, null); v.evaluateJavascript(BRIDGE_JS, null); sendNav(); } }
            @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (!req.isForMainFrame()) return;
                // (ERR_CACHE_MISS: 다시 보내야 하는 페이지를 되살릴 때 나요. 주소로 한 번 새로 열어요)
                CharSequence d = err.getDescription();
                if (!cacheRetried && d != null && d.toString().contains("CACHE_MISS")) { cacheRetried = true; v.loadUrl(url()); return; }
                showOffline();
            }
            // 화면을 그리는 쪽이 죽었을 때(메모리 부족 등): 앱은 그대로 두고 새 화면으로 다시 열어요. 30초 안에 세 번째면 멈추고 안내 화면
            @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail det) {
                long now = System.currentTimeMillis();
                System.arraycopy(gone, 1, gone, 0, 2); gone[2] = now;
                note("화면이 멈춰서 다시 불러왔어요 (" + (det.didCrash() ? "화면 오류" : "메모리 부족") + ")");
                ui.post(() -> {
                    phoneMode = false; applyMode();
                    makeWeb();
                    if (now - gone[0] < 30000) showOffline(); else { toastPage("화면이 멈춰서 다시 불러와요"); open(); }
                });
                return true;
            }
            // (실리태번 밖의 주소는 브라우저로)
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl(), home = Uri.parse(url());
                if ("data".equals(u.getScheme()) || (home.getHost() != null && home.getHost().equals(u.getHost()))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* 열 앱이 없어요 */ }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i;
                try { i = p.createIntent(); } catch (Exception e) { i = new Intent(Intent.ACTION_GET_CONTENT); }
                i.addCategory(Intent.CATEGORY_OPENABLE);
                // (실리태번은 ".jsonl" 같은 확장자로 고르라고 해요: 안드로이드는 그걸 모르니 아무 파일이나)
                if (i.getType() == null || i.getType().startsWith(".")) i.setType("*/*");
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(i, FILE_REQ); } catch (Exception e) { fileCb = null; cb.onReceiveValue(null); }
                return true;
            }
        });
    }

    private void guard(WebView v, int n) {
        if (v != web || n > 50) return;
        v.evaluateJavascript(GUARD_JS, null);
        ui.postDelayed(() -> guard(v, n + 1), 30);
    }

    // ---- 앱이 꺼질 때 이유 적어 두기 → 다음에 켤 때 보여주기
    private File crashFile() { return new File(getFilesDir(), "crash.txt"); }
    private void catchCrashes() {
        Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            try (FileOutputStream o = new FileOutputStream(crashFile(), true)) {
                StringWriter w = new StringWriter(); e.printStackTrace(new PrintWriter(w));
                o.write(("앱이 꺼졌어요 · " + Build.MODEL + " · Android " + Build.VERSION.RELEASE + "\n" + w + "\n").getBytes(StandardCharsets.UTF_8));
            } catch (Exception ignored) { /* 적지 못해도 꺼지는 건 그대로 */ }
            if (prev != null) prev.uncaughtException(t, e);
        });
    }
    private void note(String msg) {
        try (FileOutputStream o = new FileOutputStream(crashFile(), true)) { o.write((msg + "\n").getBytes(StandardCharsets.UTF_8)); } catch (Exception ignored) { /* 기록만 못 해요 */ }
    }
    private void showLastCrash() {
        File f = crashFile(); if (!f.exists()) return;
        String t;
        try { t = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8); } catch (Exception e) { t = ""; }
        f.delete();
        if (!t.contains("앱이 꺼졌어요")) return; // (다시 불러오기만 한 건 안 보여줘요)
        final String txt = t.length() > 6000 ? t.substring(t.length() - 6000) : t;
        new AlertDialog.Builder(this).setTitle("지난번에 앱이 꺼졌어요").setMessage(txt)
            .setPositiveButton("복사", (d, w) -> { ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("NarrativeArchive", txt)); toastPage("복사했어요"); })
            .setNegativeButton("닫기", null).show();
    }

    // ---- 캐릭터 폰을 연 동안: 상단바 숨김 · 하단 버튼 줄 밑까지
    @SuppressWarnings("deprecation")
    private void applyMode() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(!phoneMode);
            WindowInsetsController ic = w.getInsetsController();
            if (ic != null) {
                if (phoneMode) { ic.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); ic.hide(WindowInsets.Type.statusBars()); }
                else ic.show(WindowInsets.Type.statusBars());
            }
        } else {
            View d = w.getDecorView();
            int f = d.getSystemUiVisibility();
            d.setSystemUiVisibility(phoneMode ? f | View.SYSTEM_UI_FLAG_FULLSCREEN : f & ~View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
        if (phoneMode) { w.setStatusBarColor(Color.TRANSPARENT); phoneNav(); }
        else setBars(barTop, barBottom);
        fitPhone();
    }
    // 폰을 연 동안 하단 버튼 줄: 완전히 투명하면 버튼이 안 보였어요. 텔레그램처럼 화면 아래 색을 반투명(70%)으로 깔아서 뒤가 이어져 보이면서 뿌옇게
    @SuppressWarnings("deprecation")
    private void phoneNav() {
        Window w = getWindow();
        w.setNavigationBarColor(Color.argb(178, Color.red(barBottom), Color.green(barBottom), Color.blue(barBottom)));
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController ic = w.getInsetsController();
            if (ic != null) ic.setSystemBarsAppearance(light(barBottom) ? WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS : 0, WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }
    }
    private void fitPhone() {
        if (web == null) return;
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) web.getLayoutParams();
        int m = phoneMode && Build.VERSION.SDK_INT >= 30 ? imeBottom : 0;
        if (lp.bottomMargin != m) { lp.bottomMargin = m; web.setLayoutParams(lp); }
        sendNav();
    }
    private void sendNav() {
        if (web == null) return;
        float dp = phoneMode && Build.VERSION.SDK_INT >= 30 && imeBottom == 0 ? navBottom / getResources().getDisplayMetrics().density : 0;
        web.evaluateJavascript("document.documentElement.style.setProperty('--na-nb','" + Math.round(dp) + "px')", null);
    }

    private String url() { return prefs.getString("url", DEF_URL); }
    private String cmd() { return prefs.getString("cmd", DEF_CMD); }

    // 실리태번이 켜져 있으면 띄우고, 아니면 안내 화면
    private void open() {
        new Thread(() -> { boolean up = reachable(); ui.post(() -> { if (up) web.loadUrl(url()); else showOffline(); }); }).start();
    }

    private boolean reachable() {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url()).openConnection();
            c.setConnectTimeout(1500); c.setReadTimeout(1500); c.setRequestMethod("GET");
            int code = c.getResponseCode(); c.disconnect();
            return code > 0;
        } catch (Exception e) { return false; }
    }

    private void showOffline() {
        if (waiting) return;
        setBars(Color.parseColor("#F2F2F4"), Color.parseColor("#F2F2F4"));
        String h = "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>" +
            "body{margin:0;font-family:sans-serif;background:#f2f2f4;color:#15171c;display:flex;flex-direction:column;min-height:100vh;box-sizing:border-box;padding:56px 22px 28px}" +
            "h1{font-size:26px;margin:0 0 8px}p{color:#6b707a;font-size:14px;line-height:1.5;margin:0 0 24px}" +
            "label{font-size:12px;color:#8a8f99;font-weight:600;display:block;margin:14px 4px 6px}" +
            "input{width:100%;box-sizing:border-box;border:0;border-radius:14px;padding:13px 14px;font-size:15px;background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.05)}" +
            "button{width:100%;border:0;border-radius:999px;padding:16px;font-size:15px;font-weight:600;margin-top:12px}" +
            ".go{background:#15161a;color:#fff;margin-top:auto}.re{background:#e6e8ec;color:#15161a}</style>" +
            "<h1>실리태번이 꺼져 있어요</h1><p>Termux로 켜면 켜질 때까지 기다렸다가 열어요.</p>" +
            "<label>주소</label><input id=u value=\"" + esc(url()) + "\">" +
            "<label>Termux에서 켜는 명령</label><input id=c value=\"" + esc(cmd()) + "\">" +
            "<button class=go onclick=\"NAShell.save(u.value,c.value);NAShell.startTermux()\">Termux로 켜기</button>" +
            "<button class=re onclick=\"NAShell.save(u.value,c.value);NAShell.retry()\">다시 열기</button>";
        web.loadDataWithBaseURL("data:", h, "text/html", "utf-8", null);
    }

    private static String esc(String t) { return t.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;"); }

    // Termux에 명령 보내기 (Termux 쪽 허락: ~/.termux/termux.properties 에 allow-external-apps = true)
    private void startTermux() {
        if (checkSelfPermission("com.termux.permission.RUN_COMMAND") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"com.termux.permission.RUN_COMMAND"}, PERM_REQ);
            return;
        }
        Intent i = new Intent();
        i.setClassName("com.termux", "com.termux.app.RunCommandService");
        i.setAction("com.termux.RUN_COMMAND");
        i.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash");
        i.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{"-lc", cmd()});
        i.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home");
        i.putExtra("com.termux.RUN_COMMAND_BACKGROUND", false);
        i.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "1");
        try { startService(i); } catch (Exception e) { toastPage("Termux에 보내지 못했어요: " + e.getMessage()); return; }
        waitForServer(0);
    }

    // 켜질 때까지 1초마다, 60초까지
    private void waitForServer(int n) {
        waiting = true;
        if (n == 0) web.loadDataWithBaseURL("data:", "<!doctype html><meta name=viewport content='width=device-width'><body style='margin:0;background:#f2f2f4;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#6b707a'>실리태번을 켜는 중…</body>", "text/html", "utf-8", null);
        new Thread(() -> {
            boolean up = reachable();
            ui.post(() -> {
                if (up) { waiting = false; web.loadUrl(url()); }
                else if (n < 60) ui.postDelayed(() -> waitForServer(n + 1), 1000);
                else { waiting = false; showOffline(); }
            });
        }).start();
    }

    private void toastPage(String msg) { android.widget.Toast.makeText(this, msg, android.widget.Toast.LENGTH_LONG).show(); }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        if (req == PERM_REQ && res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) startTermux();
        else if (req == PERM_REQ) toastPage("Termux 명령 권한이 없어요. 설정 › 앱 › NarrativeArchive › 권한에서 켜 주세요");
    }

    @Override
    protected void onActivityResult(int req, int code, Intent data) {
        if (req != FILE_REQ || fileCb == null) { super.onActivityResult(req, code, data); return; }
        Uri[] out = null;
        if (code == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                out = new Uri[n];
                for (int k = 0; k < n; k++) out[k] = data.getClipData().getItemAt(k).getUri();
            } else if (data.getData() != null) out = new Uri[]{data.getData()};
        }
        fileCb.onReceiveValue(out);
        fileCb = null;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(window.__naBack&&window.__naBack())?1:0", r -> {
            if ("1".equals(r)) return;
            if (web.canGoBack()) web.goBack(); else MainActivity.super.onBackPressed();
        });
    }

    // ---- 바 색
    private static final Pattern RGB = Pattern.compile("rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)");

    static int parse(String c, int fallback) {
        if (c == null) return fallback;
        c = c.trim();
        try {
            Matcher m = RGB.matcher(c);
            if (m.find()) return Color.rgb(Math.round(Float.parseFloat(m.group(1))), Math.round(Float.parseFloat(m.group(2))), Math.round(Float.parseFloat(m.group(3))));
            if (c.startsWith("#") && c.length() == 4) c = "#" + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2) + c.charAt(3) + c.charAt(3);
            return Color.parseColor(c);
        } catch (Exception e) { return fallback; }
    }

    private static boolean light(int c) { return (0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c)) > 160; }

    @SuppressWarnings("deprecation")
    private void setBars(int top, int bottom) {
        barTop = top; barBottom = bottom;
        if (phoneMode) { phoneNav(); return; }
        Window w = getWindow();
        w.setStatusBarColor(top);
        w.setNavigationBarColor(bottom);
        if (Build.VERSION.SDK_INT >= 29) w.setNavigationBarContrastEnforced(false);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController ic = w.getInsetsController();
            if (ic != null) {
                int on = (light(top) ? WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0) | (light(bottom) ? WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS : 0);
                ic.setSystemBarsAppearance(on, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
        } else {
            View d = w.getDecorView();
            int f = d.getSystemUiVisibility() & ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            if (light(top)) f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (light(bottom)) f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            d.setSystemUiVisibility(f);
        }
    }

    // 페이지에서 부르는 것 (window.NAShell)
    private class Bridge {
        @JavascriptInterface public void setBars(String top, String bottom) {
            int t = parse(top, Color.parseColor("#333333")), b = parse(bottom, t);
            ui.post(() -> MainActivity.this.setBars(t, b));
        }
        @JavascriptInterface public void save(String u, String c) {
            SharedPreferences.Editor e = prefs.edit();
            if (u != null && u.trim().startsWith("http")) e.putString("url", u.trim());
            if (c != null && !c.trim().isEmpty()) e.putString("cmd", c.trim());
            e.apply();
        }
        @JavascriptInterface public void retry() { ui.post(() -> { waiting = false; open(); }); }
        @JavascriptInterface public void startTermux() { ui.post(MainActivity.this::startTermux); }
        // 캐릭터 폰을 열고 닫을 때 확장이 불러요
        @JavascriptInterface public void phone(boolean on) { ui.post(() -> { if (phoneMode != on) { phoneMode = on; applyMode(); } }); }
        @JavascriptInterface public String version() { return "2"; }
    }
}

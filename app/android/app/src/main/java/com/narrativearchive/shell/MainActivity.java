package com.narrativearchive.shell;

import android.app.Activity;
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

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * NarrativeArchive 껍데기 앱: 폰 안의 실리태번(기본 http://127.0.0.1:8000)을 띄우기만 해요.
 *  - 상단바 · 하단바 색을 페이지가 알려 주는 색으로 칠해요 (theme-color · 페이지 바탕). 확장이 폰 화면 색을 거기에 적어요
 *  - 실리태번이 꺼져 있으면 Termux에 켜는 명령을 보내고, 켜질 때까지 기다렸다가 띄워요
 *  - 파일 고르기(사진 · 채팅 파일, 여러 장)는 안드로이드 파일 창으로
 * 실리태번 데이터는 Termux 쪽에 그대로 있어요. 이 앱은 주소와 켜는 명령만 기억해요.
 */
public class MainActivity extends Activity {
    private static final int FILE_REQ = 1, PERM_REQ = 2;
    private static final String DEF_URL = "http://127.0.0.1:8000/";
    private static final String DEF_CMD = "cd ~/SillyTavern && ./start.sh";

    private WebView web;
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
        "new MutationObserver(kick).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['content','style','class'],childList:true});" +
        "setInterval(send,1500);send();" +
        "window.__naBack=function(){var p=document.getElementById('na_phl');if(p&&p.open){p.close();return 1;}" +
        "var d=[].slice.call(document.querySelectorAll('dialog[open]')).pop();if(d){var c=d.querySelector('.popup-button-cancel,.popup-button-close,.menu_button_cancel');if(c){c.click();}else{d.close();}return 1;}return 0;};})();";

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs = getSharedPreferences("shell", MODE_PRIVATE);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        web.addJavascriptInterface(new Bridge(), "NAShell");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String url) { if (url != null && url.startsWith("http")) v.evaluateJavascript(BRIDGE_JS, null); }
            @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) { if (req.isForMainFrame()) showOffline(); }
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
                Intent i = p.createIntent();
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(i, FILE_REQ); } catch (ActivityNotFoundException e) { fileCb = null; return false; }
                return true;
            }
        });
        setBars(Color.parseColor("#333333"), Color.parseColor("#333333"));
        if (saved != null) web.restoreState(saved); else open();
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

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
        @JavascriptInterface public String version() { return "1"; }
    }
}

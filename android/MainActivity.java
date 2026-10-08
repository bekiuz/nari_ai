package com.bekiuz.zuxrash;

import android.Manifest;
import android.app.Activity;
import android.app.Dialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://nari-ai.ai.studio/";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int MEDIA_PERMISSION_REQUEST = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingPermissionRequest;

    private Dialog popupDialog;
    private WebView popupWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = createWebView(false);
        setContentView(webView);
        webView.loadUrl(HOME_URL);
    }

    private WebView createWebView(boolean popup) {
        WebView view = new WebView(this);
        view.setBackgroundColor(Color.rgb(9, 5, 13));

        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " ZuxrashAI-Android/1.2");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(view, true);
        }

        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();

                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    return false;
                }

                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams fileChooserParams) {

                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = callback;

                Intent chooser = fileChooserParams.createIntent();
                try {
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(
                            MainActivity.this,
                            "File picker could not be opened",
                            Toast.LENGTH_SHORT
                    ).show();
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    pendingPermissionRequest = request;

                    boolean needsAudio = false;
                    boolean needsVideo = false;

                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            needsAudio = true;
                        }
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            needsVideo = true;
                        }
                    }

                    boolean audioGranted =
                            !needsAudio
                                    || checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                                    == PackageManager.PERMISSION_GRANTED;

                    boolean videoGranted =
                            !needsVideo
                                    || checkSelfPermission(Manifest.permission.CAMERA)
                                    == PackageManager.PERMISSION_GRANTED;

                    if (audioGranted && videoGranted) {
                        grantAllowedWebResources(request);
                        pendingPermissionRequest = null;
                        return;
                    }

                    if (needsAudio && needsVideo) {
                        requestPermissions(
                                new String[]{
                                        Manifest.permission.RECORD_AUDIO,
                                        Manifest.permission.CAMERA
                                },
                                MEDIA_PERMISSION_REQUEST
                        );
                    } else if (needsAudio) {
                        requestPermissions(
                                new String[]{Manifest.permission.RECORD_AUDIO},
                                MEDIA_PERMISSION_REQUEST
                        );
                    } else if (needsVideo) {
                        requestPermissions(
                                new String[]{Manifest.permission.CAMERA},
                                MEDIA_PERMISSION_REQUEST
                        );
                    }
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingPermissionRequest == request) {
                    pendingPermissionRequest = null;
                }
            }

            @Override
            public boolean onCreateWindow(
                    WebView sourceView,
                    boolean isDialog,
                    boolean isUserGesture,
                    Message resultMsg) {

                popupWebView = createWebView(true);

                popupDialog = new Dialog(
                        MainActivity.this,
                        android.R.style.Theme_DeviceDefault_NoActionBar_Fullscreen
                );

                FrameLayout container = new FrameLayout(MainActivity.this);
                container.setBackgroundColor(Color.BLACK);
                container.addView(
                        popupWebView,
                        new FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                        )
                );

                popupDialog.setContentView(container);
                popupDialog.setOnDismissListener(dialog -> {
                    if (popupWebView != null) {
                        popupWebView.destroy();
                        popupWebView = null;
                    }
                    popupDialog = null;
                });

                popupDialog.show();

                WebView.WebViewTransport transport =
                        (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();

                return true;
            }

            @Override
            public void onCloseWindow(WebView window) {
                closePopup();
                super.onCloseWindow(window);
            }
        });

        view.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) {
            }
        });

        return view;
    }

    private void grantAllowedWebResources(PermissionRequest request) {
        if (request == null) {
            return;
        }

        java.util.ArrayList<String> allowed = new java.util.ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                    || PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                allowed.add(resource);
            }
        }

        if (allowed.isEmpty()) {
            request.deny();
        } else {
            request.grant(allowed.toArray(new String[0]));
        }
    }

    private void closePopup() {
        runOnUiThread(() -> {
            if (popupDialog != null && popupDialog.isShowing()) {
                popupDialog.dismiss();
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode != FILE_CHOOSER_REQUEST) {
            return;
        }

        if (filePathCallback == null) {
            return;
        }

        Uri[] results = null;

        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];

                for (int i = 0; i < count; i++) {
                    results[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
        }

        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults) {

        super.onRequestPermissionsResult(
                requestCode,
                permissions,
                grantResults
        );

        if (requestCode != MEDIA_PERMISSION_REQUEST
                || pendingPermissionRequest == null) {
            return;
        }

        boolean allGranted = true;

        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (allGranted) {
            grantAllowedWebResources(pendingPermissionRequest);
        } else {
            pendingPermissionRequest.deny();
        }

        pendingPermissionRequest = null;
    }

    @Override
    public void onBackPressed() {
        if (popupDialog != null && popupDialog.isShowing()) {
            closePopup();
            return;
        }

        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (popupWebView != null) {
            popupWebView.destroy();
            popupWebView = null;
        }

        if (webView != null) {
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}

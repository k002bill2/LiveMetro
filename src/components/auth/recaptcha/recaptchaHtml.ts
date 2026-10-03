/**
 * recaptchaHtml — WebView 안에서 Firebase invisible/normal reCAPTCHA 를 띄우는 HTML.
 *
 * expo-firebase-recaptcha 2.3.1 (MIT, SDK 48 에서 제거) 의 getWebviewSource 를 이식했다.
 * 동작 동일성을 위해 firebase 스크립트 버전(8.0.0)과 메시지 프로토콜을 그대로 유지한다.
 */

export interface RecaptchaFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export type RecaptchaMessage =
  | { type: 'load' }
  | { type: 'error' }
  | { type: 'fullChallenge' }
  | { type: 'verify'; token: string };

export const RECAPTCHA_FIREBASE_VERSION = '8.0.0';

const LANGUAGE_CODE = /^[a-z]{2}(-[A-Z]{2})?$/;

/** JSON 을 <script> 안에 넣을 때 `</script>` 로 태그가 닫히지 않도록 `<` 를 이스케이프한다. */
const toScriptJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

export function buildRecaptchaSource(
  config: RecaptchaFirebaseConfig,
  options: { invisible: boolean; languageCode?: string },
): { baseUrl: string; html: string } {
  const { invisible } = options;
  const lang = options.languageCode && LANGUAGE_CODE.test(options.languageCode) ? options.languageCode : '';
  const v = RECAPTCHA_FIREBASE_VERSION;
  const target = invisible ? 'recaptcha-btn' : 'recaptcha-cont';
  const body = invisible
    ? '<button id="recaptcha-btn" type="button" onclick="onClickButton()">Confirm reCAPTCHA</button>'
    : '<div id="recaptcha-cont" class="g-recaptcha"></div>';

  const html = `<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <script src="https://www.gstatic.com/firebasejs/${v}/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/${v}/firebase-auth.js"></script>
  <script type="text/javascript">firebase.initializeApp(${toScriptJson(config)});</script>
  <style>
    html, body { height: 100%; ${invisible ? 'padding: 0; margin: 0;' : ''} }
    #recaptcha-btn { width: 100%; height: 100%; padding: 0; margin: 0; border: 0; user-select: none; -webkit-user-select: none; }
  </style>
</head>
<body>
  ${body}
  <script>
    var fullChallengeTimer;
    function post(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
    function onVerify(token) {
      if (fullChallengeTimer) { clearInterval(fullChallengeTimer); fullChallengeTimer = undefined; }
      post({ type: 'verify', token: token });
    }
    function onLoad() {
      post({ type: 'load' });
      ${lang ? `firebase.auth().languageCode = '${lang}';` : ''}
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("${target}", {
        size: "${invisible ? 'invisible' : 'normal'}",
        callback: onVerify
      });
      window.recaptchaVerifier.render();
    }
    function onError() { post({ type: 'error' }); }
    function onClickButton() {
      if (fullChallengeTimer) return;
      fullChallengeTimer = setInterval(function () {
        var iframes = document.getElementsByTagName("iframe");
        var isFullChallenge = false;
        for (var i = 0; i < iframes.length; i++) {
          var parentWindow = iframes[i].parentNode ? iframes[i].parentNode.parentNode : undefined;
          var isHidden = parentWindow && parentWindow.style.opacity == 0;
          isFullChallenge = isFullChallenge || (!isHidden &&
            (iframes[i].title === 'recaptcha challenge' ||
             iframes[i].src.indexOf('google.com/recaptcha/api2/bframe') >= 0));
        }
        if (isFullChallenge) {
          clearInterval(fullChallengeTimer);
          fullChallengeTimer = undefined;
          post({ type: 'fullChallenge' });
        }
      }, 100);
    }
    window.addEventListener('message', function (event) {
      if (event.data && event.data.verify) { document.getElementById('recaptcha-btn').click(); }
    });
  </script>
  <script src="https://www.google.com/recaptcha/api.js?onload=onLoad&render=explicit&hl=${lang}" onerror="onError()"></script>
</body></html>`;

  return { baseUrl: `https://${config.authDomain}`, html };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function parseRecaptchaMessage(raw: string): RecaptchaMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  switch (data.type) {
    case 'load':
    case 'error':
    case 'fullChallenge':
      return { type: data.type };
    case 'verify':
      return typeof data.token === 'string' && data.token.length > 0
        ? { type: 'verify', token: data.token }
        : null;
    default:
      return null;
  }
}

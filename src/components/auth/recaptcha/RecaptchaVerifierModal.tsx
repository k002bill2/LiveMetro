/**
 * RecaptchaVerifierModal — Firebase JS SDK 전화 인증용 ApplicationVerifier.
 *
 * expo-firebase-recaptcha 2.3.1 의 FirebaseRecaptchaVerifierModal 을 함수 컴포넌트로 이식했다.
 * 1) 숨은 WebView 에서 invisible reCAPTCHA 를 먼저 시도하고
 * 2) 구글이 전체 챌린지를 요구하거나 숨은 WebView 가 아직 준비되지 않았으면 모달 WebView 로 전환한다.
 * Firebase 는 내부적으로 verifier._reset() 을 호출하므로 핸들에 반드시 포함한다.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { ApplicationVerifier } from 'firebase/auth';

import { useSemanticTokens } from '@/services/theme';
import { weightToFontFamily } from '@/styles/modernTheme';
import {
  buildRecaptchaSource,
  parseRecaptchaMessage,
  RecaptchaFirebaseConfig,
} from '@/components/auth/recaptcha/recaptchaHtml';

export interface RecaptchaVerifierHandle extends ApplicationVerifier {
  _reset: () => void;
}

interface RecaptchaVerifierModalProps {
  firebaseConfig: RecaptchaFirebaseConfig;
  title: string;
  cancelLabel: string;
  languageCode?: string;
  testID?: string;
}

interface Pending {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

type Outcome = { token: string } | { error: Error };

const VERIFY_SCRIPT =
  "(function(){window.dispatchEvent(new MessageEvent('message',{data:{verify:true}}));})();true;";

export const RecaptchaVerifierModal = forwardRef<RecaptchaVerifierHandle, RecaptchaVerifierModalProps>(
  function RecaptchaVerifierModal(
    { firebaseConfig, title, cancelLabel, languageCode, testID = 'recaptcha-verifier' },
    ref,
  ) {
    const semantic = useSemanticTokens();
    const pending = useRef<Pending | null>(null);
    const invisibleRef = useRef<WebView>(null);
    const invisibleLoaded = useRef(false);
    const [visible, setVisible] = useState(false);
    const [visibleLoaded, setVisibleLoaded] = useState(false);
    const [invisibleKey, setInvisibleKey] = useState(1);

    const invisibleSource = useMemo(
      () => buildRecaptchaSource(firebaseConfig, { invisible: true, languageCode }),
      [firebaseConfig, languageCode],
    );
    const visibleSource = useMemo(
      () => buildRecaptchaSource(firebaseConfig, { invisible: false, languageCode }),
      [firebaseConfig, languageCode],
    );

    const settle = useCallback((outcome: Outcome) => {
      const current = pending.current;
      pending.current = null;
      setVisible(false);
      if (!current) return;
      if ('token' in outcome) current.resolve(outcome.token);
      else current.reject(outcome.error);
    }, []);

    const openModal = useCallback(() => {
      setVisibleLoaded(false);
      setVisible(true);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        type: 'recaptcha',
        verify: () =>
          new Promise<string>((resolve, reject) => {
            pending.current?.reject(new Error('RECAPTCHA_SUPERSEDED'));
            pending.current = { resolve, reject };
            if (invisibleLoaded.current && invisibleRef.current) {
              invisibleRef.current.injectJavaScript(VERIFY_SCRIPT);
            } else {
              openModal();
            }
          }),
        _reset: () => undefined,
      }),
      [openModal],
    );

    useEffect(
      () => () => {
        pending.current?.reject(new Error('RECAPTCHA_UNMOUNTED'));
        pending.current = null;
      },
      [],
    );

    const handleMessage = useCallback(
      (source: 'invisible' | 'visible') => (event: WebViewMessageEvent) => {
        const message = parseRecaptchaMessage(event.nativeEvent.data);
        if (!message) return;
        switch (message.type) {
          case 'load':
            if (source === 'invisible') invisibleLoaded.current = true;
            else setVisibleLoaded(true);
            return;
          case 'fullChallenge':
            openModal();
            return;
          case 'error':
            settle({ error: new Error('RECAPTCHA_LOAD_FAILED') });
            return;
          case 'verify':
            // 토큰은 1회용 — 숨은 WebView 를 새로 만들어 다음 verify 에 대비한다
            invisibleLoaded.current = false;
            setInvisibleKey((k) => k + 1);
            settle({ token: message.token });
            return;
        }
      },
      [openModal, settle],
    );

    const cancel = useCallback(() => settle({ error: new Error('RECAPTCHA_CANCELLED') }), [settle]);

    return (
      <View style={styles.container} testID={testID}>
        <WebView
          key={`invisible-${invisibleKey}`}
          ref={invisibleRef}
          testID={`${testID}-invisible`}
          style={styles.invisible}
          javaScriptEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          source={invisibleSource}
          onMessage={handleMessage('invisible')}
        />
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
          <SafeAreaView style={[styles.modal, { backgroundColor: semantic.bgBase }]}>
            <View style={[styles.header, { borderBottomColor: semantic.lineSubtle }]}>
              <TouchableOpacity
                onPress={cancel}
                style={styles.cancel}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                testID={`${testID}-cancel`}
              >
                <Text style={{ color: semantic.primaryNormal, fontFamily: weightToFontFamily('600') }}>
                  {cancelLabel}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') }]}>
                {title}
              </Text>
            </View>
            <View style={styles.content}>
              {visible && (
                <WebView
                  testID={`${testID}-visible`}
                  style={styles.content}
                  javaScriptEnabled
                  originWhitelist={['*']}
                  mixedContentMode="always"
                  source={visibleSource}
                  onMessage={handleMessage('visible')}
                />
              )}
              {!visibleLoaded && (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color={semantic.primaryNormal} />
                </View>
              )}
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { width: 0, height: 0 },
  invisible: { width: 300, height: 300 },
  modal: { flex: 1 },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancel: {
    position: 'absolute',
    left: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  title: { fontSize: 16 },
  content: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
});

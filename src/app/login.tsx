import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { Screen, Text, TextInput } from '@/components/themed';
import { colors } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/supabase';

type Mode = 'sign_in' | 'sign_up';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !busy;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === 'sign_in') {
      setError(await signIn(email, password));
    } else {
      const result = await signUp(email, password);
      setError(result.error);
      if (result.needsConfirmation) {
        setNotice('Check your email to confirm your account, then sign in.');
        setMode('sign_in');
      }
    }

    setBusy(false);
  }

  function switchMode() {
    setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in');
    setError(null);
    setNotice(null);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          gap: 14,
        }}>
        <View style={{ gap: 6, marginBottom: 12 }}>
          <Text style={{ fontSize: 34, fontWeight: '700' }}>Hoarder</Text>
          <Text style={{ color: colors.textMuted }}>
            {mode === 'sign_in' ? 'Sign in to continue.' : 'Create an account.'}
          </Text>
        </View>

        {!isSupabaseConfigured ? (
          <Text style={{ color: colors.danger }}>
            Login is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY to .env
            and restart Expo.
          </Text>
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (6+ characters)"
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
          textContentType={mode === 'sign_in' ? 'password' : 'newPassword'}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        {notice ? <Text style={{ color: colors.textMuted }}>{notice}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          style={{
            backgroundColor: colors.text,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: canSubmit ? 1 : 0.4,
          }}>
          {busy ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={{ color: colors.background, fontSize: 16, fontWeight: '600' }}>
              {mode === 'sign_in' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={switchMode} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
          <Text style={{ color: colors.textMuted }}>
            {mode === 'sign_in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

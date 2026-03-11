import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiError } from '../../../shared/api/http';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { useAuth } from '../AuthContext';

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = username.trim().length > 0 && password.trim().length > 0 && !isSubmitting;

  const onSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible iniciar sesión. Verifica conexión e intenta nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={[palette.navy, '#283a4c', '#3e586f']} style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.card}>
          <Text style={styles.brand}>MONTBLAN</Text>
          <Text style={styles.title}>Sistema de Pedidos</Text>
          <Text style={styles.subtitle}>Acceso móvil para ventas y almacén</Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Usuario"
            autoCapitalize="none"
            style={styles.input}
            placeholderTextColor="#8ea0ae"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            secureTextEntry
            style={styles.input}
            placeholderTextColor="#8ea0ae"
          />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && styles.buttonPressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonLabel}>Iniciar sesión</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  brand: {
    color: palette.navy,
    fontFamily: typography.bold,
    fontSize: 26,
    letterSpacing: 1,
  },
  title: {
    marginTop: 2,
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 18,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    color: palette.text,
    fontFamily: typography.regular,
    backgroundColor: '#fbfdff',
  },
  error: {
    color: palette.danger,
    fontFamily: typography.medium,
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
  },
  button: {
    backgroundColor: palette.primary,
    borderRadius: 10,
    marginTop: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: palette.primaryDark,
  },
  buttonDisabled: {
    backgroundColor: '#9ecac0',
  },
  buttonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 15,
  },
});

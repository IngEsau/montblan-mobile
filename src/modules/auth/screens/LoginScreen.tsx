import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../../shared/api/http';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { useAuth } from '../AuthContext';

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Montblan';
    }
  }, []);

  return (
    <LinearGradient colors={[palette.navy, '#283a4c', '#3e586f']} style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../../../assets/logo-montblan.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.brand}>MONTBLAN</Text>
            <Text style={styles.title}>Sistema de Pedidos</Text>
            <Text style={styles.subtitle}>Acceso móvil para ventas y almacén</Text>

            <View style={styles.fieldHeader}>
              <Ionicons name="person-outline" size={16} color={palette.navy} />
              <Text style={styles.fieldLabel}>Usuario</Text>
            </View>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Ingresa tu usuario"
              autoCapitalize="none"
              style={styles.input}
              placeholderTextColor="#8ea0ae"
            />

            <View style={styles.fieldHeader}>
              <Ionicons name="lock-closed-outline" size={16} color={palette.navy} />
              <Text style={styles.fieldLabel}>Contraseña</Text>
            </View>
            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Ingresa tu contraseña"
                secureTextEntry={!isPasswordVisible}
                style={styles.passwordInput}
                placeholderTextColor="#8ea0ae"
              />
              <Pressable
                onPress={() => setIsPasswordVisible((prev) => !prev)}
                style={styles.passwordToggle}
              >
                <Ionicons
                  name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#5f7384"
                />
              </Pressable>
            </View>

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
        </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 44,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 46,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
    minHeight: 620,
  },
  logoWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#fff',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(34, 55, 76, 0.14)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  logoImage: {
    width: 88,
    height: 88,
  },
  brand: {
    color: palette.navy,
    fontFamily: typography.bold,
    fontSize: 26,
    letterSpacing: 1,
    textAlign: 'center',
  },
  title: {
    marginTop: 16,
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 18,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    marginBottom: 36,
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  fieldLabel: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
    color: palette.text,
    fontFamily: typography.regular,
    backgroundColor: '#fbfdff',
  },
  passwordWrap: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: '#fbfdff',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    color: palette.text,
    fontFamily: typography.regular,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  passwordToggle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: palette.danger,
    fontFamily: typography.medium,
    marginTop: 2,
    marginBottom: 10,
    fontSize: 12,
  },
  button: {
    backgroundColor: palette.primary,
    borderRadius: 10,
    marginTop: 4,
    paddingVertical: 14,
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

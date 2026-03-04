import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const { login } = useAuth();

  const clearAllErrors = () => {
    setEmailError('');
    setPasswordError('');
    setGeneralError('');
  };

  const handleLogin = async () => {
    clearAllErrors();

    let hasError = false;
    
    if (!email) {
      setEmailError('Email is required');
      hasError = true;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      hasError = true;
    }

    if (hasError) return;

    try {
      setLoading(true);
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred';
      clearAllErrors();
      
      if (errorMessage.toLowerCase().includes('network')) {
        setGeneralError('Network error. Please check your internet connection and try again.');
      } else if (errorMessage.toLowerCase().includes('invalid email or password')) {
        setPasswordError('Invalid email or password. Please check your credentials.');
      } else if (errorMessage.toLowerCase().includes('invalid credentials') || 
                 errorMessage.toLowerCase().includes('authentication failed')) {
        setPasswordError('Invalid email or password');
      } else if (errorMessage.toLowerCase().includes('user not found') ||
                 errorMessage.toLowerCase().includes('email not found')) {
        setEmailError('No account found with this email address');
      } else {
        setGeneralError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };
  const handleLogin2 = async () => {
    clearAllErrors();

    let hasError = false;
    
    if (!email) {
      setEmailError('Email is required');
      hasError = true;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      hasError = true;
    }

    if (hasError) return;

    try {
      setLoading(true);
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred';
      clearAllErrors();
      
      if (errorMessage.toLowerCase().includes('network')) {
        setGeneralError('Network error. Please check your internet connection and try again.');
      } else if (errorMessage.toLowerCase().includes('invalid email or password')) {
        setPasswordError('Invalid email or password. Please check your credentials.');
      } else if (errorMessage.toLowerCase().includes('invalid credentials') || 
                 errorMessage.toLowerCase().includes('authentication failed')) {
        setPasswordError('Invalid email or password');
      } else if (errorMessage.toLowerCase().includes('user not found') ||
                 errorMessage.toLowerCase().includes('email not found')) {
        setEmailError('No account found with this email address');
      } else {
        setGeneralError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  style={styles.tinyLogo}
                  source={require("../../assets/images/logo.jpg")}
                />
              </View>
            </View>

            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Welcome to DJ Rental Pro</Text>
              <Text style={styles.welcomeSubtitle}>
                Please confirm your account details to continue
              </Text>
            </View>

            {generalError ? (
              <View style={styles.generalErrorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#ef4444" style={styles.errorIcon} />
                <Text style={styles.generalErrorText}>{generalError}</Text>
              </View>
            ) : null}

            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <View style={[styles.inputContainer, emailError && styles.inputContainerError]}>
                  <Ionicons 
                    name="mail-outline" 
                    size={20} 
                    color={emailError ? "#ef4444" : "#8696a0"} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#8696a0"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (emailError) setEmailError('');
                      if (generalError) setGeneralError('');
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    editable={!loading}
                  />
                </View>
                {emailError ? (
                  <Text style={styles.errorText}>{emailError}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <View style={[styles.passwordContainer, passwordError && styles.inputContainerError]}>
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={passwordError ? "#ef4444" : "#8696a0"} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Password"
                    placeholderTextColor="#8696a0"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (passwordError) setPasswordError('');
                      if (generalError) setGeneralError('');
                    }}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    disabled={loading}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color="#8696a0" 
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <Text style={styles.errorText}>{passwordError}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.forgotLink}>
                <Text style={styles.forgotText}>
                  <Text style={styles.forgotTextBold}>Forgot Password?</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>CONTINUE</Text>
                )}
              </TouchableOpacity>

            </View>

            <View style={styles.footer}>
              <Link href="/(auth)/register" asChild> 
               {/*<Link href="/(tabs)/index" asChild>*/}
                <TouchableOpacity style={styles.signupLink}>
                  <Text style={styles.signupText}>
                    Don't have an account?{" "}
                    <Text style={styles.signupTextBold}>Sign up</Text>
                  </Text>
                </TouchableOpacity>
              </Link>
              
              <View style={styles.termsSection}>
                <Text style={styles.termsText}>
                  By continuing, you agree to our{'\n'}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginTop: 120,
  },
  logoContainer: {
    marginBottom: 16,
  },
  tinyLogo: {
    width: 90,
    height: 90,
    borderRadius: 20,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 60,
    paddingHorizontal: 20,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#8696a0',
    textAlign: 'center',
    lineHeight: 20,
  },
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    marginHorizontal: 4,
  },
  errorIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  generalErrorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 14,
    lineHeight: 20,
  },
  formSection: {
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 2,
    paddingHorizontal: 15,
  },
  inputContainerError: {
    borderColor: '#ef4444',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '400',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 2,
    paddingHorizontal: 15,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '400',
  },
  eyeButton: {
    padding: 5,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  forgotLink: {
    marginBottom: 30,
  },
  forgotText: {
    fontSize: 14,
    color: '#8696a0',
    textAlign: 'right',
  },
  forgotTextBold: {
    color: '#07918f',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#0cadab',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  signupLink: {
    marginBottom: 30,
  },
  signupText: {
    fontSize: 14,
    color: '#8696a0',
    textAlign: 'center',
  },
  signupTextBold: {
    color: '#07918f',
    fontWeight: '500',
  },
  termsSection: {
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: '#8696a0',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#1f3121',
  },
});
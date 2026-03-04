import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
};

export default function RegisterScreen() {
  const { register } = useAuth();

  // Form data
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ScrollView ref to control scrolling
  const scrollRef = useRef<ScrollView>(null);

  // Steps definition
  const steps = [
    {
      title: "What's your name?",
      validate: () => {
        if (!formData.firstName.trim()) return 'First name is required';
        if (!formData.lastName.trim()) return 'Last name is required';
        return '';
      },
      render: () => (
        <>
          <InputGroup
            label="First Name"
            icon="person-outline"
            value={formData.firstName}
            onChange={(text: string) => setFormData({ ...formData, firstName: text })}
            placeholder="First name"
            autoComplete="given-name"
          />
          <InputGroup
            label="Last Name"
            icon="person-outline"
            value={formData.lastName}
            onChange={(text: string) => setFormData({ ...formData, lastName: text })}
            placeholder="Last name"
            autoComplete="family-name"
          />
        </>
      ),
    },
    {
      title: "How can we reach you?",
      validate: () => {
        if (!formData.email.trim()) return 'Email is required';
        if (!/\S+@\S+\.\S+/.test(formData.email)) return 'Invalid email format';
        if (!formData.phone.trim()) return 'Phone number is required';
        if (formData.phone.replace(/\D/g, '').length < 9) return 'Phone number seems too short';
        return '';
      },
      render: () => (
        <>
          <InputGroup
            label="Email"
            icon="mail-outline"
            value={formData.email}
            onChange={(text: string) => setFormData({ ...formData, email: text })}
            placeholder="your.email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <InputGroup
            label="Phone Number"
            icon="call-outline"
            value={formData.phone}
            onChange={(text: string) => setFormData({ ...formData, phone: text })}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
          />
        </>
      ),
    },
    {
      title: "Create a secure password",
      validate: () => {
        if (!formData.password) return 'Password is required';
        if (formData.password.length < 6) return 'Password must be at least 6 characters';
        if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
        return '';
      },
      render: () => (
        <>
          <PasswordGroup
            label="Password"
            value={formData.password}
            onChange={(text: string) => setFormData({ ...formData, password: text })}
          />
          <PasswordGroup
            label="Confirm Password"
            value={formData.confirmPassword}
            onChange={(text: string) => setFormData({ ...formData, confirmPassword: text })}
          />
        </>
      ),
    },
    {
      title: "Almost done!",
      validate: () => '', // optional field
      render: () => (
        <InputGroup
          label="Date of Birth (optional)"
          icon="calendar-outline"
          value={formData.dateOfBirth}
          onChange={(text: string) => setFormData({ ...formData, dateOfBirth: text })}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
      ),
    },
  ];

  // Scroll to top after step change
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentStep]);

  const handleNext = () => {
    const error = steps[currentStep].validate?.() || '';
    if (error) {
      setGeneralError(error);
      return;
    }

    setGeneralError('');

    if (currentStep < steps.length - 1) {
      // Slide out current → change step → slide in new
      Animated.timing(slideAnim, {
        toValue: -SCREEN_WIDTH,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep + 1);
        slideAnim.setValue(SCREEN_WIDTH); // start from right

        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep - 1);
        slideAnim.setValue(-SCREEN_WIDTH);

        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setGeneralError('');

    try {
      await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password,
        dateOfBirth: formData.dateOfBirth.trim() || undefined,
      });
      // Navigation handled by auth context usually
    } catch (error: any) {
      setGeneralError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 20}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Image style={styles.tinyLogo} source={require('../../assets/images/logo.jpg')} />
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${((currentStep + 1) / steps.length) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.stepText}>
                Step {currentStep + 1} of {steps.length}
              </Text>
            </View>

            {/* Animated content container */}
            <Animated.View
              style={{
                transform: [{ translateX: slideAnim }],
                opacity: slideAnim.interpolate({
                  inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                  outputRange: [0, 1, 0],
                }),
              }}
            >
              <Text style={styles.title}>{steps[currentStep].title}</Text>

              {generalError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
                  <Text style={styles.errorText}>{generalError}</Text>
                </View>
              ) : null}

              {steps[currentStep].render()}
            </Animated.View>

            {/* Navigation buttons - fixed at bottom */}
            <View style={styles.buttonContainer}>
              {currentStep > 0 && (
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                  <Ionicons name="arrow-back" size={22} color="#07918f" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.nextButton,
                  loading && styles.disabledButton,
                ]}
                onPress={handleNext}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.nextButtonText}>
                    {currentStep === steps.length - 1 ? 'CREATE ACCOUNT' : 'NEXT'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Link href="/(auth)/login" asChild>
                <Text style={styles.loginText}>
                  Already have an account? <Text style={styles.loginBold}>Sign in</Text>
                </Text>
              </Link>
              <Text style={styles.termsText}>
                By continuing, you agree to our Terms of Service and Privacy Policy
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

// ─── Reusable Input Components ────────────────────────────────────────────────────────
function InputGroup({
  label,
  icon,
  value,
  onChange,
  placeholder,
  keyboardType = 'default',
  autoComplete,
  autoCapitalize = 'words',
}: {
  label: string;
  icon: string;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numbers-and-punctuation';
  autoComplete?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name={icon} size={20} color="#8696a0" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </View>
  );
}

function PasswordGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color="#8696a0" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          value={value}
          onChangeText={onChange}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#8696a0" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 60,
    paddingHorizontal: 0,
  },
  header: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 20,
  },
  tinyLogo: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  progressContainer: {
    paddingHorizontal: 32,
    marginBottom: 24,
    alignItems: 'center',
  },
  progressBar: {
    height: 6,
    width: '100%',
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#07918f',
  },
  stepText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8696a0',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  errorContainer: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 32,
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  eyeIcon: {
    padding: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    marginTop: 32,
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#07918f',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  nextButton: {
    backgroundColor: '#07918f',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 40,
    minWidth: 160,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
  },
  loginText: {
    color: '#8696a0',
    fontSize: 15,
    marginBottom: 16,
  },
  loginBold: {
    color: '#07918f',
    fontWeight: '600',
  },
  termsText: {
    color: '#8696a0',
    fontSize: 12,
    textAlign: 'center',
  },
});
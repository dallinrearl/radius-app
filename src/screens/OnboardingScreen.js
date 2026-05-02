import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { PrimaryButton } from '../components/Common';
import {
  UsersIcon,
  CalendarIcon,
  ChartIcon,
  HeartIcon,
  CardIcon,
} from '../components/Icons';
import ContactForm from '../components/ContactForm';
import { EMPTY_CONTACT } from '../constants';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: UsersIcon,
    title: 'Welcome to Radius',
    text: 'Your personal CRM for the relationships that matter.',
    color: '#3B6EE6',
  },
  {
    icon: CalendarIcon,
    title: 'Stay on Schedule',
    text: 'Set follow-up cadences. Get nudged before relationships go cold.',
    color: '#48B8E0',
  },
  {
    icon: HeartIcon,
    title: 'Remember the Details',
    text: 'Capture personal details, conversation notes, and shared interests.',
    color: '#E060A0',
  },
  {
    icon: ChartIcon,
    title: 'See Your Network',
    text: 'Visualize your relationships, activity, and growth over time.',
    color: '#7B5EEA',
  },
  {
    icon: CardIcon,
    title: 'Capture Anywhere',
    text: 'Scan business cards, dictate voice notes, or share QR codes.',
    color: '#00C9A7',
  },
];

export default function OnboardingScreen({
  myCard,
  onSaveMyCard,
  onFinish,
  allTags,
  onAddTag,
  allInterests,
  onAddInterest,
  contacts,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [showCardForm, setShowCardForm] = useState(false);
  const [form, setForm] = useState(myCard || { ...EMPTY_CONTACT });
  const tx = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => tx.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50 && step < SLIDES.length) {
          setStep(step + 1);
          tx.setValue(0);
        } else if (g.dx > 50 && step > 0) {
          setStep(step - 1);
          tx.setValue(0);
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  if (showCardForm) {
    return (
      <ContactForm
        form={form}
        setForm={setForm}
        onSave={() => {
          onSaveMyCard(form);
          onFinish();
        }}
        onCancel={() => setShowCardForm(false)}
        title="Set Up Your Card"
        contacts={contacts}
        allTags={allTags}
        onAddTag={onAddTag}
        allInterests={allInterests}
        onAddInterest={onAddInterest}
        isMyCard
      />
    );
  }

  if (step >= SLIDES.length) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          padding: 20,
          paddingTop: insets.top + 60,
        }}
      >
        <Text
          style={{
            fontSize: 28,
            color: theme.t1,
            fontWeight: '600',
            fontFamily: theme.fontDisplay,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          One More Thing
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: theme.t4,
            textAlign: 'center',
            marginBottom: 30,
            paddingHorizontal: 20,
          }}
        >
          Set up your own contact card so you can share it with others via QR code.
        </Text>
        <View
          style={{
            backgroundColor: theme.bg2,
            borderRadius: 18,
            padding: 24,
            alignItems: 'center',
            marginHorizontal: 20,
            marginBottom: 30,
          }}
        >
          <CardIcon size={50} color={theme.ac} strokeWidth={1.4} />
          <Text style={{ fontSize: 16, color: theme.t1, fontWeight: '600', marginTop: 16 }}>
            Your Digital Card
          </Text>
          <Text style={{ fontSize: 12, color: theme.t5, textAlign: 'center', marginTop: 8 }}>
            Name, role, contact info, social links. You can edit it anytime in Settings.
          </Text>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <PrimaryButton onPress={() => setShowCardForm(true)} label="Set Up My Card" />
          <TouchableOpacity onPress={onFinish} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: theme.t5, fontSize: 13 }}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const current = SLIDES[step];
  const Icon = current.icon;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }} {...pan.panHandlers}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: insets.top,
          paddingHorizontal: 30,
        }}
      >
        <Animated.View style={{ alignItems: 'center', transform: [{ translateX: tx }] }}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: current.color + '22',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 30,
            }}
          >
            <Icon size={48} color={current.color} strokeWidth={1.5} />
          </View>
          <Text
            style={{
              fontSize: 28,
              color: theme.t1,
              fontWeight: '600',
              fontFamily: theme.fontDisplay,
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            {current.title}
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: theme.t4,
              textAlign: 'center',
              lineHeight: 22,
              maxWidth: 320,
            }}
          >
            {current.text}
          </Text>
        </Animated.View>
      </View>

      {/* Dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 24,
        }}
      >
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === step ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === step ? current.color : theme.brd2,
            }}
          />
        ))}
      </View>

      {/* Buttons */}
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          padding: 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        {step > 0 && (
          <TouchableOpacity
            onPress={() => setStep(step - 1)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.brd2,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.t4, fontSize: 14, fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 2 }}>
          <PrimaryButton
            onPress={() => setStep(step + 1)}
            label={step === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          />
        </View>
      </View>
    </View>
  );
}

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { PrimaryButton } from '../components/Common';
import ContactForm from '../components/ContactForm';
import { EMPTY_CONTACT } from '../constants';

const TOTAL_STEPS = 5;

const SLIDES = [
  {
    label: 'WELCOME',
    headline: 'Welcome to Veery.',
    body: 'A personal relationship manager for the people who matter most.',
  },
  {
    label: 'ALWAYS-ON ASSISTANT',
    headline: 'Make people your priority.',
    body:
      'AI helps you remember, follow up, and stay close, without it ever feeling like work.',
  },
  {
    label: 'THE DETAILS THAT MATTER',
    headline: 'Remember the details.',
    body:
      "Their kids' names, what they care about, what you talked about last. So they feel how much they matter to you.",
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

  const [phase, setPhase] = useState('use_type');
  const [slideIndex, setSlideIndex] = useState(0);
  const [useType, setUseType] = useState([]);
  const [samplesRequested, setSamplesRequested] = useState(null);
  const [form, setForm] = useState(myCard || { ...EMPTY_CONTACT });

  const tx = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => tx.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) advanceSlide();
        else if (g.dx > 50) goBackSlide();
        else Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  function advanceSlide() {
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex(slideIndex + 1);
      tx.setValue(0);
    } else {
      setPhase('card_intro');
      tx.setValue(0);
    }
  }
  function goBackSlide() {
    if (slideIndex > 0) {
      setSlideIndex(slideIndex - 1);
      tx.setValue(0);
    } else {
      setPhase('use_type');
      tx.setValue(0);
    }
  }

  function toggleUseType(value) {
    setUseType((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function finishOnboarding(samplesChoice) {
    const finalSamples =
      typeof samplesChoice === 'boolean' ? samplesChoice : samplesRequested;
    onFinish({
      useType,
      samplesRequested: finalSamples,
    });
  }

  function currentStepNumber() {
    if (phase === 'use_type') return 1;
    if (phase === 'slides') return 2 + slideIndex;
    if (phase === 'card_intro') return 5;
    return null;
  }

  const stepNum = currentStepNumber();

  // ---- Phase: card_form ----
  // Pass onSkip so the ContactForm renders a Skip button next to Save.
  // Skipping jumps directly to the samples phase without saving the card.
  if (phase === 'card_form') {
    return (
      <ContactForm
        form={form}
        setForm={setForm}
        onSave={() => {
          onSaveMyCard(form);
          setPhase('samples');
        }}
        onCancel={() => setPhase('card_intro')}
        onSkip={() => setPhase('samples')}
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

  if (phase === 'samples') {
    return (
      <Shell theme={theme} insets={insets} showProgress={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <StepLabel theme={theme} text="ALMOST THERE" />
          <Headline theme={theme} text="Want a few sample contacts?" />
          <Body
            theme={theme}
            text="We can drop in two examples so you can see how Veery works. Clear them anytime."
          />
        </View>
        <Footer
          theme={theme}
          primaryLabel="Add sample contacts"
          onPrimary={() => {
            setSamplesRequested(true);
            finishOnboarding(true);
          }}
          secondaryLabel="Start with a blank slate"
          onSecondary={() => {
            setSamplesRequested(false);
            finishOnboarding(false);
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell
      theme={theme}
      insets={insets}
      showProgress
      stepNum={stepNum}
      totalSteps={TOTAL_STEPS}
      panHandlers={phase === 'slides' ? pan.panHandlers : undefined}
    >
      {phase === 'use_type' && (
        <UseTypePhase
          theme={theme}
          stepNum={stepNum}
          useType={useType}
          toggleUseType={toggleUseType}
        />
      )}

      {phase === 'slides' && (
        <SlidePhase
          theme={theme}
          slide={SLIDES[slideIndex]}
          tx={tx}
        />
      )}

      {phase === 'card_intro' && <CardIntroPhase theme={theme} />}

      {phase === 'use_type' && (
        <Footer
          theme={theme}
          primaryLabel="Continue"
          primaryDisabled={useType.length === 0}
          onPrimary={() => {
            if (useType.length > 0) setPhase('slides');
          }}
        />
      )}

      {phase === 'slides' && (
        <Footer
          theme={theme}
          primaryLabel="Continue"
          onPrimary={advanceSlide}
          showBack
          onBack={goBackSlide}
        />
      )}

      {phase === 'card_intro' && (
        <Footer
          theme={theme}
          primaryLabel="Set Up My Card"
          onPrimary={() => setPhase('card_form')}
          secondaryLabel="Skip for now"
          onSecondary={() => setPhase('samples')}
        />
      )}
    </Shell>
  );
}

function Shell({
  theme,
  insets,
  showProgress,
  stepNum,
  totalSteps,
  panHandlers,
  children,
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 28,
      }}
      {...(panHandlers || {})}
    >
      {showProgress && (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 64 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: i < stepNum ? theme.ac : theme.brd2,
              }}
            />
          ))}
        </View>
      )}
      {!showProgress && <View style={{ height: 24 }} />}
      {children}
    </View>
  );
}

function UseTypePhase({ theme, stepNum, useType, toggleUseType }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', maxWidth: 560 }}>
      <StepLabel theme={theme} text={`${pad(stepNum)} — HOW YOU'LL USE IT`} />
      <Headline theme={theme} text="How will you use Veery?" />
      <Body
        theme={theme}
        text="Pick one or both. We'll tailor the tags and prompts to fit how you connect."
      />

      <View style={{ marginTop: 32, gap: 10 }}>
        <UseTypeOption
          theme={theme}
          label="Personal"
          description="Family, friends, neighbors, the people in your life."
          selected={useType.includes('personal')}
          onPress={() => toggleUseType('personal')}
        />
        <UseTypeOption
          theme={theme}
          label="Professional"
          description="Colleagues, clients, mentors, and your network."
          selected={useType.includes('professional')}
          onPress={() => toggleUseType('professional')}
        />
      </View>
    </View>
  );
}

function SlidePhase({ theme, slide, tx }) {
  return (
    <Animated.View
      style={{
        flex: 1,
        justifyContent: 'center',
        maxWidth: 560,
        transform: [{ translateX: tx }],
      }}
    >
      <StepLabel theme={theme} text={slide.label} />
      <Headline theme={theme} text={slide.headline} />
      <Body theme={theme} text={slide.body} />
    </Animated.View>
  );
}

function CardIntroPhase({ theme }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', maxWidth: 560 }}>
      <StepLabel theme={theme} text="05 — YOUR CARD" />
      <Headline theme={theme} text="Set up your card." />
      <Body
        theme={theme}
        text="Name, role, contact info. Share it with a tap, by QR code, link, or as a contact file. You can edit it anytime."
      />
    </View>
  );
}

function StepLabel({ theme, text }) {
  return (
    <Text
      style={{
        fontSize: 12,
        color: theme.t5,
        fontFamily: theme.fontBodySemi,
        letterSpacing: 1.5,
        marginBottom: 28,
      }}
    >
      {text}
    </Text>
  );
}

function Headline({ theme, text }) {
  return (
    <Text
      style={{
        fontSize: 40,
        color: theme.t1,
        fontFamily: theme.fontDisplay,
        lineHeight: 46,
        letterSpacing: -0.5,
        marginBottom: 20,
      }}
    >
      {text}
    </Text>
  );
}

function Body({ theme, text }) {
  return (
    <Text
      style={{
        fontSize: 16,
        color: theme.t4,
        lineHeight: 24,
        fontFamily: theme.fontBody,
        maxWidth: 420,
      }}
    >
      {text}
    </Text>
  );
}

function Footer({
  theme,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  showBack,
  onBack,
}) {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ opacity: primaryDisabled ? 0.4 : 1 }}>
        <PrimaryButton
          onPress={() => {
            if (!primaryDisabled) onPrimary?.();
          }}
          label={primaryLabel}
        />
      </View>

      {(secondaryLabel || showBack) && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 24,
            paddingVertical: 4,
          }}
        >
          {showBack && (
            <TouchableOpacity onPress={onBack} style={{ paddingVertical: 6 }}>
              <Text
                style={{
                  color: theme.t5,
                  fontSize: 13,
                  fontFamily: theme.fontBody,
                }}
              >
                Back
              </Text>
            </TouchableOpacity>
          )}
          {secondaryLabel && (
            <TouchableOpacity onPress={onSecondary} style={{ paddingVertical: 6 }}>
              <Text
                style={{
                  color: theme.t5,
                  fontSize: 13,
                  fontFamily: theme.fontBody,
                }}
              >
                {secondaryLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function UseTypeOption({ theme, label, description, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected ? theme.ac : theme.brd2,
        backgroundColor: selected ? theme.bgAc : theme.bg2,
        paddingVertical: 18,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: selected ? theme.ac : theme.brd2,
          backgroundColor: selected ? theme.ac : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && (
          <Text style={{ color: theme.bg, fontSize: 12, fontWeight: '700', lineHeight: 14 }}>
            ✓
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            color: theme.t1,
            fontFamily: theme.fontBodySemi,
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 13, color: theme.t4, lineHeight: 18, fontFamily: theme.fontBody }}>
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function pad(n) {
  return String(n).padStart(2, '0');
}
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useTheme } from '../styles/theme';
import { XIcon } from './Icons';
import { PRICING } from '../utils/tierLimits';

// PaywallModal — shown when a free user hits the AI cap or taps a Pro feature.
// Reason determines copy: 'ai_limit_reached' for cap, 'pro_feature' for locked
// feature tap, otherwise generic.
//
// Props:
//   visible: boolean
//   reason: 'ai_limit_reached' | 'pro_feature' | string | null
//   onDismiss: () => void
//   onStartTrial: () => void
//   trialAvailable: boolean (whether user qualifies for trial — true if never trialed)

export default function PaywallModal({
  visible,
  reason,
  onDismiss,
  onStartTrial,
  trialAvailable = true,
}) {
  const { theme } = useTheme();
  // Track which plan the user picks. Default to annual since it's the
  // better deal — encourages people toward the higher LTV option.
  const [selectedPlan, setSelectedPlan] = useState('annual');

  // Reset selection when modal closes/reopens so it doesn't carry over.
  useEffect(() => {
    if (visible) setSelectedPlan('annual');
  }, [visible]);

  const copy = getCopy(reason);

  function handleStartTrial() {
    if (onStartTrial) {
      onStartTrial(selectedPlan);
    } else {
      Alert.alert(
        'Coming soon',
        'Subscription billing is being set up. Hang tight!',
        [{ text: 'OK', onPress: onDismiss }],
      );
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: theme.bg,
            borderRadius: 18,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            borderWidth: 1,
            borderColor: theme.brd,
          }}
        >
          {/* Close button */}
          <TouchableOpacity
            onPress={onDismiss}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              padding: 8,
              zIndex: 1,
            }}
          >
            <XIcon size={18} color={theme.t5} />
          </TouchableOpacity>

          {/* Icon */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.bgAc,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 16,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 24, color: theme.ac }}>
              {reason === 'pro_feature' ? '✦' : '✨'}
            </Text>
          </View>

          {/* Headline */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: theme.t1,
              textAlign: 'center',
              marginBottom: 8,
              fontFamily: theme.fontDisplay,
            }}
          >
            {copy.headline}
          </Text>

          {/* Body */}
          <Text
            style={{
              fontSize: 13,
              color: theme.t4,
              textAlign: 'center',
              lineHeight: 19,
              marginBottom: 22,
            }}
          >
            {copy.body}
          </Text>

          {/* Feature list */}
          <View style={{ marginBottom: 22, gap: 8 }}>
            {copy.features.map((f, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: theme.bgAc,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: theme.ac, fontSize: 11, fontWeight: '700' }}>✓</Text>
                </View>
                <Text style={{ fontSize: 13, color: theme.t3, flex: 1 }}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Plan selector — Monthly vs Annual. Annual is highlighted as the
              better deal (BEST VALUE badge). Tap to select. */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <PlanCard
              theme={theme}
              selected={selectedPlan === 'monthly'}
              onPress={() => setSelectedPlan('monthly')}
              label="Monthly"
              price="$9.99"
              period="/mo"
            />
            <PlanCard
              theme={theme}
              selected={selectedPlan === 'annual'}
              onPress={() => setSelectedPlan('annual')}
              label="Annual"
              price="$89.99"
              period="/yr"
              badge="BEST VALUE"
              subline="Save $30"
            />
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            onPress={handleStartTrial}
            activeOpacity={0.8}
            style={{
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: theme.ac,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
              {trialAvailable
                ? `Start ${PRICING.trialDays}-day free trial`
                : 'Upgrade to Pro'}
            </Text>
          </TouchableOpacity>

          {/* Secondary CTA */}
          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.7}
            style={{
              paddingVertical: 11,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.brd2,
              backgroundColor: theme.bg2,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.t4, fontSize: 13, fontWeight: '600' }}>Maybe later</Text>
          </TouchableOpacity>

          {/* Pricing footer */}
          <Text
            style={{
              fontSize: 11,
              color: theme.t6,
              textAlign: 'center',
              marginTop: 12,
              lineHeight: 15,
            }}
          >
            {PRICING.proMonthly.label} or {PRICING.proAnnual.label} (save{' '}
            {PRICING.proAnnual.savings}).{' '}
            {trialAvailable ? 'Cancel anytime during trial.' : 'Cancel anytime.'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Reason-specific copy. Add cases as new gating points come online.
function getCopy(reason) {
  if (reason === 'ai_limit_reached') {
    return {
      headline: "You've used your 5 AI calls this month",
      body: "Try Pro free for 7 days and keep your AI features running. Cancel anytime, no charge if you cancel before the trial ends.",
      features: [
        'Unlimited AI insights, prep, and templates',
        'Granola AI processing — auto-extract from meetings',
        'Business card scanning, multi-device sync',
      ],
    };
  }
  if (reason === 'granola_ai_processing' || reason === 'pro_feature') {
    return {
      headline: 'Pro feature',
      body: 'Granola AI processing extracts contact details from your meeting transcripts and auto-populates your CRM. Try Pro free for 7 days.',
      features: [
        'AI suggestions for unmatched meeting attendees',
        'Auto-extract notes per attendee',
        'AI meeting summaries to identify contacts',
      ],
    };
  }
  if (reason === 'business_card_scan') {
    return {
      headline: 'Pro feature',
      body: 'Snap a photo of a business card and Radius will create the contact for you.',
      features: [
        'Vision AI extracts name, role, company, contact info',
        'Plus everything in Pro',
      ],
    };
  }
  if (reason === 'ai_outreaches') {
    return {
      headline: 'AI Outreach Suggestions',
      body: 'Let AI surface 2-5 people in your network who deserve a check-in right now, with specific reasons why.',
      features: [
        'Smart relationship intelligence across your contacts',
        'Catches stagnant high-priority relationships',
        'Surfaces upcoming birthdays, anniversaries, and follow-ups',
      ],
    };
  }
  return {
    headline: 'Upgrade to Pro',
    body: 'Unlock unlimited AI features and the full Radius experience.',
    features: [
      'Unlimited AI insights, prep, and templates',
      'Granola AI processing',
      'All Pro features unlocked',
    ],
  };
}

// PlanCard — single billing option in the plan selector. Highlighted with
// accent border + background when selected.
function PlanCard({ theme, selected, onPress, label, price, period, badge, subline }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: selected ? theme.ac : theme.brd2,
        backgroundColor: selected ? theme.bgAc : theme.bg2,
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -8,
            paddingHorizontal: 8,
            paddingVertical: 2,
            backgroundColor: theme.ac,
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff', letterSpacing: 0.5 }}>
            {badge}
          </Text>
        </View>
      ) : null}
      <Text
        style={{
          fontSize: 11,
          color: selected ? theme.ac : theme.t5,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 4,
          marginTop: badge ? 4 : 0,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: selected ? theme.ac : theme.t1,
          }}
        >
          {price}
        </Text>
        <Text style={{ fontSize: 11, color: theme.t5 }}>{period}</Text>
      </View>
      {subline ? (
        <Text style={{ fontSize: 10, color: theme.ac, marginTop: 2, fontWeight: '600' }}>
          {subline}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}
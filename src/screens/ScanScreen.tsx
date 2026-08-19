import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { Food } from '../types';
import { colors, radius, space, verdictStyle } from '../theme';
import { foodByBarcode, riskyAdditiveCount, safetyOf, scannableCount } from '../lib/db';
import { ScoreDial } from '../components/SafetyBadge';

/**
 * The app's home screen: point the camera at a product barcode and get its
 * safety report.
 *
 * The scanner fires continuously while the camera is open, so a `locked` ref
 * gates it — without that, one barcode in view produces dozens of results a
 * second and the screen thrashes.
 */
export function ScanScreen({ onOpenFood }: { onOpenFood: (food: Food) => void }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [hit, setHit] = useState<{ code: string; food: Food | undefined } | null>(null);
  const [manual, setManual] = useState(false);
  const locked = useRef(false);

  const lookUp = useCallback((code: string) => {
    setHit({ code, food: foodByBarcode(code) });
  }, []);

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (locked.current) return;
      locked.current = true;
      lookUp(result.data.trim());
    },
    [lookUp]
  );

  const scanAgain = () => {
    setHit(null);
    locked.current = false;
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space(3) }]}>
      <Text style={styles.title}>SafeBite</Text>
      <Text style={styles.tagline}>Scan a barcode to see what is really in it</Text>
    </View>
  );

  // ---- manual entry (also the way out when the camera is unavailable) ----
  if (manual) {
    return (
      <View style={styles.root}>
        {header}
        <ManualEntry
          onSubmit={lookUp}
          onCancel={() => {
            setManual(false);
            scanAgain();
          }}
          result={hit}
          onOpenFood={onOpenFood}
          insets={insets.bottom}
        />
      </View>
    );
  }

  // ---- permission gates -------------------------------------------------
  if (!permission) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.info}>
          <Text style={styles.infoTitle}>Starting the camera…</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.info}>
          <Text style={styles.infoEmoji}>📷</Text>
          <Text style={styles.infoTitle}>Camera access needed</Text>
          <Text style={styles.infoBody}>
            SafeBite reads the barcode on the pack to look the product up. The camera is only used
            while this screen is open, and nothing is recorded or sent anywhere.
          </Text>
          {permission.canAskAgain ? (
            <PrimaryButton label="Allow camera" onPress={requestPermission} />
          ) : (
            <Text style={styles.infoBody}>
              Permission was denied. You can turn the camera back on for SafeBite in your phone's
              app settings, or type the barcode in by hand.
            </Text>
          )}
          <SecondaryButton label="Type a barcode instead" onPress={() => setManual(true)} />
        </View>
      </View>
    );
  }

  // ---- the scanner ------------------------------------------------------
  return (
    <View style={styles.root}>
      {header}

      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          // Everything a food pack realistically carries, plus QR for the odd
          // product that puts a link on the label.
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14', 'qr'],
          }}
          onBarcodeScanned={hit ? undefined : handleScan}
        />

        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.reticle} />
          <Text style={styles.hint}>{hit ? ' ' : 'Line the barcode up inside the frame'}</Text>
        </View>

        <Pressable
          onPress={() => setTorch((t) => !t)}
          style={[styles.torch, torch && styles.torchOn]}
          accessibilityRole="button"
          accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
        >
          <Text style={styles.torchIcon}>{torch ? '🔦' : '💡'}</Text>
        </Pressable>
      </View>

      <View style={[styles.tray, { paddingBottom: insets.bottom + space(4) }]}>
        {hit ? (
          hit.food ? (
            <ResultCard food={hit.food} onOpen={() => onOpenFood(hit.food!)} onAgain={scanAgain} />
          ) : (
            <NotFoundCard code={hit.code} onAgain={scanAgain} />
          )
        ) : (
          <>
            <Text style={styles.trayIdle}>
              {scannableCount.toLocaleString()} products can be found by barcode.
            </Text>
            <Pressable
              onPress={() => setManual(true)}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.linkWrap}
            >
              <Text style={styles.link}>Type a barcode instead</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Typing a code by hand. Without this, a denied camera permission leaves the
 * app with nothing it can do at all.
 */
function ManualEntry({
  onSubmit,
  onCancel,
  result,
  onOpenFood,
  insets,
}: {
  onSubmit: (code: string) => void;
  onCancel: () => void;
  result: { code: string; food: Food | undefined } | null;
  onOpenFood: (food: Food) => void;
  insets: number;
}) {
  const [text, setText] = useState('');
  const digits = text.replace(/\D/g, '');

  return (
    <View style={[styles.manual, { paddingBottom: insets + space(4) }]}>
      <Text style={styles.manualLabel}>BARCODE NUMBER</Text>
      <TextInput
        style={styles.manualInput}
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        placeholder="e.g. 3017620425035"
        placeholderTextColor={colors.textFaint}
        maxLength={14}
        autoFocus
        onSubmitEditing={() => digits && onSubmit(digits)}
        accessibilityLabel="Barcode number"
      />
      <Text style={styles.manualHint}>
        The long number printed under the bars on the pack.
      </Text>

      <PrimaryButton
        label={digits ? `Look up ${digits}` : 'Look up'}
        onPress={() => digits && onSubmit(digits)}
      />
      <SecondaryButton label="Back to the camera" onPress={onCancel} />

      {result &&
        (result.food ? (
          <View style={styles.manualResult}>
            <ResultCard food={result.food} onOpen={() => onOpenFood(result.food!)} />
          </View>
        ) : (
          <View style={styles.manualResult}>
            <NotFoundCard code={result.code} />
          </View>
        ))}
    </View>
  );
}

function ResultCard({
  food,
  onOpen,
  onAgain,
}: {
  food: Food;
  onOpen: () => void;
  onAgain?: () => void;
}) {
  const safety = safetyOf(food);
  const v = verdictStyle[safety.verdict];
  const risky = riskyAdditiveCount(food);

  return (
    <View>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          styles.result,
          { borderColor: v.color + '66' },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${food.name}, ${v.label}`}
      >
        <ScoreDial score={safety.score} verdict={safety.verdict} size={54} />
        <View style={styles.resultText}>
          <Text style={styles.resultName} numberOfLines={2}>
            {food.name}
          </Text>
          <Text style={styles.resultBrand} numberOfLines={1}>
            {food.brand}
          </Text>
          <Text style={[styles.resultVerdict, { color: v.color }]}>
            {v.label}
            {risky > 0 ? `  ·  ${risky} additive${risky > 1 ? 's' : ''} of concern` : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {onAgain && <SecondaryButton label="Scan another" onPress={onAgain} />}
    </View>
  );
}

function NotFoundCard({ code, onAgain }: { code: string; onAgain?: () => void }) {
  return (
    <View>
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Not in the database</Text>
        <Text style={styles.notFoundBody}>
          Barcode <Text style={styles.code}>{code}</Text> did not match any product SafeBite knows
          about. The code was read correctly — the product simply is not in the dataset yet.
        </Text>
      </View>
      {onAgain && <SecondaryButton label="Scan again" onPress={onAgain} />}
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
      accessibilityRole="button"
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.7 },

  header: { paddingHorizontal: space(4), paddingBottom: space(3) },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  info: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8) },
  infoEmoji: { fontSize: 44, marginBottom: space(4) },
  infoTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: space(2) },
  infoBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: space(2),
  },

  cameraWrap: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: '78%',
    height: 150,
    borderWidth: 3,
    borderColor: '#FFFFFFCC',
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: space(4),
    textShadowColor: '#000000AA',
    textShadowRadius: 4,
  },
  torch: {
    position: 'absolute',
    right: space(4),
    bottom: space(4),
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchOn: { backgroundColor: colors.primary },
  torchIcon: { fontSize: 20 },

  tray: {
    paddingHorizontal: space(4),
    paddingTop: space(4),
    backgroundColor: colors.bg,
    minHeight: 150,
    justifyContent: 'center',
  },
  trayIdle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  linkWrap: { alignSelf: 'center', paddingVertical: space(2) },
  link: { fontSize: 13, color: colors.primaryDark, fontWeight: '800' },

  manual: { flex: 1, paddingHorizontal: space(4), paddingTop: space(2) },
  manualLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: colors.textMuted,
    marginBottom: space(2),
  },
  manualInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: space(4),
    height: 58,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  manualHint: { fontSize: 12, color: colors.textFaint, marginTop: space(2) },
  manualResult: { marginTop: space(5) },

  result: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: space(3),
  },
  resultText: { flex: 1, marginHorizontal: space(3) },
  resultName: { fontSize: 15, fontWeight: '800', color: colors.text },
  resultBrand: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  resultVerdict: { fontSize: 12, fontWeight: '700', marginTop: space(1) },
  chevron: { fontSize: 26, color: colors.textFaint },

  notFound: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
  },
  notFoundTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  notFoundBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: space(2) },
  code: { fontWeight: '800', color: colors.text },

  primary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space(3.5),
    alignItems: 'center',
    marginTop: space(4),
  },
  primaryPressed: { backgroundColor: colors.primaryDark },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondary: {
    borderRadius: radius.md,
    paddingVertical: space(3.5),
    alignItems: 'center',
    marginTop: space(3),
    backgroundColor: colors.surfaceAlt,
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
});

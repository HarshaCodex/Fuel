import { StyleSheet, Text, View } from 'react-native';

import type { ActivityLevel, Gender } from '@/api/user';
import { ACTIVITIES, type BodyStatsForm } from '@/lib/bodyStatsForm';
import { hapticSelect } from '@/lib/haptics';
import { customDeficitError, rowError } from '@/lib/setupView';
import { radius, sizing, space, type, useTheme } from '@/theme';

import { BottomSheet } from './BottomSheet';
import { PressableScale } from './PressableScale';
import { TextField } from './TextField';

export type StatKind = 'age' | 'height' | 'weight';

type StatProps = {
  kind: StatKind | null;
  form: BodyStatsForm;
  onChange: (patch: Partial<BodyStatsForm>) => void;
  /** Done pressed: the parent closes the sheet and recalculates. */
  onDone: () => void;
  /** Scrim tap or Android back. */
  onClose: () => void;
};

const TITLES: Record<StatKind, string> = { age: 'Age', height: 'Height', weight: 'Weight' };

type FieldSpec = { label: string; value: string; suffix: string; keyboard: 'number-pad' | 'decimal-pad'; patch: (v: string) => Partial<BodyStatsForm> };

function statFields(kind: StatKind, form: BodyStatsForm): FieldSpec[] {
  const imperial = form.units === 'imperial';
  if (kind === 'age') return [{ label: 'Age', value: form.age, suffix: 'years', keyboard: 'number-pad', patch: (v) => ({ age: v }) }];
  if (kind === 'weight') {
    return [{ label: 'Weight', value: form.weight, suffix: imperial ? 'lb' : 'kg', keyboard: 'decimal-pad', patch: (v) => ({ weight: v }) }];
  }
  if (!imperial) return [{ label: 'Height', value: form.heightCm, suffix: 'cm', keyboard: 'decimal-pad', patch: (v) => ({ heightCm: v }) }];
  return [
    { label: 'Feet', value: form.heightFt, suffix: 'ft', keyboard: 'number-pad', patch: (v) => ({ heightFt: v }) },
    { label: 'Inches', value: form.heightIn, suffix: 'in', keyboard: 'decimal-pad', patch: (v) => ({ heightIn: v }) },
  ];
}

/** Age, height or weight entry. Edits the parent form directly; Done is disabled while the row is invalid. */
export function StatSheet({ kind, form, onChange, onDone, onClose }: StatProps) {
  const { colors } = useTheme();
  const fields = kind ? statFields(kind, form) : [];
  const error = kind ? rowError(form, kind) : undefined;
  // Stay quiet until the user has typed something; an empty field only disables Done.
  const showError = error && fields.some((f) => f.value.trim() !== '');
  return (
    <BottomSheet visible={kind !== null} title={kind ? TITLES[kind] : ''} onClose={onClose} done={{ disabled: !!error, onPress: onDone }}>
      <View style={styles.fields}>
        {fields.map((f, i) => (
          <View key={f.label} style={styles.flex}>
            <TextField
              variant="pill"
              label={f.label}
              suffix={f.suffix}
              value={f.value}
              keyboardType={f.keyboard}
              autoFocus={i === 0}
              onChangeText={(v) => onChange(f.patch(v))}
              error={showError ? error : null}
            />
          </View>
        ))}
      </View>
      {showError ? (
        <Text accessibilityLiveRegion="polite" style={[type.caption, { color: colors.danger }]} maxFontSizeMultiplier={2}>
          {error}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

type Option<T extends string> = { value: T; label: string; description?: string; min: number };

const SEX_OPTIONS: Option<Gender>[] = [
  { value: 'MALE', label: 'Male', min: 88 },
  { value: 'FEMALE', label: 'Female', min: 88 },
];
const ACTIVITY_OPTIONS: Option<ActivityLevel>[] = ACTIVITIES.map((a) => ({ ...a, min: 66 }));

function OptionCard<T extends string>({ option, selected, onSelect }: { option: Option<T>; selected: boolean; onSelect: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={option.description ? `${option.label}, ${option.description}` : option.label}
      accessibilityState={{ selected }}
      onPress={() => {
        hapticSelect();
        onSelect(option.value);
      }}
      contentStyle={[
        styles.card,
        { minHeight: option.min, backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border, borderWidth: selected ? 2 : sizing.border },
      ]}
    >
      <Text style={[styles.cardLabel, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
        {option.label}
      </Text>
      {option.description ? (
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
          {option.description}
        </Text>
      ) : null}
    </PressableScale>
  );
}

type ChoiceProps =
  | { kind: 'sex'; value: Gender | null; onSelect: (v: Gender) => void; onClose: () => void; visible: boolean }
  | { kind: 'activity'; value: ActivityLevel | null; onSelect: (v: ActivityLevel) => void; onClose: () => void; visible: boolean };

/** Sex (two cards) or activity (five cards). Choosing an option closes the sheet through `onSelect`; there is no Done. */
export function ChoiceSheet(props: ChoiceProps) {
  const { kind, visible, onClose } = props;
  return (
    <BottomSheet visible={visible} title={kind === 'sex' ? 'Sex' : 'Activity level'} onClose={onClose}>
      <View accessibilityRole="radiogroup" style={styles.cards}>
        {kind === 'sex'
          ? SEX_OPTIONS.map((o) => <OptionCard key={o.value} option={o} selected={props.value === o.value} onSelect={props.onSelect} />)
          : ACTIVITY_OPTIONS.map((o) => <OptionCard key={o.value} option={o} selected={props.value === o.value} onSelect={props.onSelect} />)}
      </View>
    </BottomSheet>
  );
}

type CustomProps = { visible: boolean; value: string; onChange: (v: string) => void; onDone: () => void; onClose: () => void };

/** Custom daily calorie change. Done stays disabled until `customDeficitError` is null. */
export function CustomChangeSheet({ visible, value, onChange, onDone, onClose }: CustomProps) {
  const { colors } = useTheme();
  const error = customDeficitError(value);
  const showError = error && value.trim() !== '';
  return (
    <BottomSheet visible={visible} title="Custom daily change" onClose={onClose} done={{ disabled: !!error, onPress: onDone }}>
      <TextField variant="pill" label="Calories per day" suffix="kcal" value={value} keyboardType="number-pad" autoFocus onChangeText={onChange} error={showError ? error : null} />
      {showError ? (
        <Text accessibilityLiveRegion="polite" style={[type.caption, { color: colors.danger }]} maxFontSizeMultiplier={2}>
          {error}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fields: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  cards: { gap: space.md },
  card: { borderRadius: radius.tile, paddingHorizontal: space.lg, paddingVertical: space.md, justifyContent: 'center', gap: space.xs },
  cardLabel: { fontSize: 17, lineHeight: 24, fontFamily: 'Manrope_700Bold' },
  cardDesc: { fontSize: 14, lineHeight: 20, fontFamily: 'Manrope_500Medium' },
});

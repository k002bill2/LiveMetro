/**
 * RouteWithTransfer — origin → (optional transfer) → destination route node
 * with an inline editor for picking among recommended alternatives.
 *
 * Topic 2 of the chat3 design hand-off (`5BgTc6iU6dK4Mlie3Ljr8Q`):
 *  ● Origin (LineBadge + station name)
 *  │
 *  ◇ Transfer (diamond marker) + "변경/추가" button
 *  │  (or ● green dot + "직행" when transfer is null)
 *  │
 *  ● Destination
 *
 * When `expanded` is true a recommended-routes panel appears below the
 * transfer node — radio list of alternatives (one of which may be the
 * direct option). Picking an option calls `onTransferChange` with the
 * resulting `TransferStation | null`. The parent should fold the panel
 * after the change to reflect the chosen state.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { LineBadge } from '@/components/design/LineBadge';
import { Radio } from '@/components/design/Radio';
import { TransferStation } from '@/models/commute';

export interface RouteEndpoint {
  stationId: string;
  stationName: string;
  lineId: string;
}

export interface TransferOption {
  /** Stable id for keying + selection comparison. */
  id: string;
  /** null → direct (직행). */
  transfer: TransferStation | null;
  etaMinutes: number;
  reason: string;
  recommended?: boolean;
}

interface Props {
  origin: RouteEndpoint;
  destination: RouteEndpoint;
  transfer: TransferStation | null;
  alternatives: readonly TransferOption[];
  onTransferChange: (next: TransferStation | null) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  testID?: string;
}

const compareTransfer = (
  a: TransferStation | null,
  b: TransferStation | null,
): boolean => {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.stationId === b.stationId;
};

export const RouteWithTransfer: React.FC<Props> = ({
  origin,
  destination,
  transfer,
  alternatives,
  onTransferChange,
  expanded,
  onToggleExpanded,
  testID = 'route-with-transfer',
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const directColor = semantic.statusPositive;

  return (
    <View style={styles.container} testID={testID}>
      {/* Origin row */}
      <View style={styles.row}>
        <View style={styles.markerColumn}>
          <View style={[styles.dotMarker, { backgroundColor: semantic.primaryNormal }]} />
          <View style={[styles.connector, { backgroundColor: semantic.lineNormal }]} />
        </View>
        <View style={styles.body}>
          <View style={styles.endpointLine}>
            <LineBadge line={origin.lineId} size={20} />
            <Text
              style={[
                styles.endpointName,
                { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') },
              ]}
            >
              {origin.stationName}
            </Text>
          </View>
          <Text
            style={[styles.endpointHint, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
          >
            출발역
          </Text>
        </View>
      </View>

      {/* Transfer node */}
      <View style={styles.row}>
        <View style={styles.markerColumn}>
          {transfer ? (
            <View style={[styles.diamondMarker, { backgroundColor: semantic.bgBase, borderColor: semantic.primaryNormal }]} />
          ) : (
            <View style={[styles.dotMarker, styles.dotMarkerSmall, { backgroundColor: directColor }]} />
          )}
          <View style={[styles.connector, { backgroundColor: semantic.lineNormal }]} />
        </View>
        <View style={styles.body}>
          {transfer ? (
            <View style={styles.endpointLine}>
              <LineBadge line={transfer.lineId} size={20} />
              <Text
                style={[
                  styles.endpointName,
                  { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') },
                ]}
              >
                {transfer.stationName}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.directLabel,
                { color: directColor, fontFamily: weightToFontFamily('700') },
              ]}
            >
              직행
            </Text>
          )}
          <Pressable
            testID={`${testID}-toggle`}
            onPress={onToggleExpanded}
            accessibilityRole="button"
            accessibilityLabel={transfer ? '환승 변경' : '환승 추가'}
            style={[styles.changeButton, { borderColor: semantic.lineSubtle }]}
          >
            <Text
              style={[
                styles.changeButtonLabel,
                { color: semantic.primaryNormal, fontFamily: weightToFontFamily('600') },
              ]}
            >
              {transfer ? '변경' : '환승 추가'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Recommended-routes panel */}
      {expanded ? (
        <View
          style={[
            styles.panel,
            { backgroundColor: semantic.bgSubtle, borderColor: semantic.lineSubtle },
          ]}
          testID={`${testID}-panel`}
        >
          <Text
            style={[
              styles.panelTitle,
              { color: semantic.labelNormal, fontFamily: weightToFontFamily('700') },
            ]}
          >
            추천 경로
          </Text>
          {alternatives.map((opt) => {
            const isSelected = compareTransfer(opt.transfer, transfer);
            return (
              <Pressable
                key={opt.id}
                testID={`${testID}-option-${opt.id}`}
                onPress={() => onTransferChange(opt.transfer)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.option,
                  {
                    backgroundColor: semantic.bgBase,
                    borderColor: isSelected ? semantic.primaryNormal : semantic.lineSubtle,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
              >
                <Radio selected={isSelected} size="sm" />

                <View style={styles.optionBody}>
                  <View style={styles.optionHeader}>
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') },
                      ]}
                    >
                      {opt.transfer ? `${opt.transfer.stationName} 환승` : '직행'}
                    </Text>
                    {opt.recommended ? (
                      <Text
                        style={[
                          styles.recommended,
                          {
                            color: semantic.primaryNormal,
                            backgroundColor: isDark
                              ? 'rgba(51,133,255,0.14)'
                              : 'rgba(0,102,255,0.08)',
                            fontFamily: weightToFontFamily('700'),
                          },
                        ]}
                      >
                        추천
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.optionMeta,
                      { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') },
                    ]}
                  >
                    약 {opt.etaMinutes}분 · 환승 {opt.transfer ? 1 : 0}회 · {opt.reason}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Destination row */}
      <View style={styles.row}>
        <View style={styles.markerColumn}>
          <View style={[styles.dotMarker, { backgroundColor: semantic.primaryNormal }]} />
        </View>
        <View style={styles.body}>
          <View style={styles.endpointLine}>
            <LineBadge line={destination.lineId} size={20} />
            <Text
              style={[
                styles.endpointName,
                { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') },
              ]}
            >
              {destination.stationName}
            </Text>
          </View>
          <Text
            style={[styles.endpointHint, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
          >
            도착역
          </Text>
        </View>
      </View>
    </View>
  );
};

const MARKER_COLUMN_WIDTH = 28;
const DOT_SIZE = 12;

const styles = StyleSheet.create({
  container: {
    paddingVertical: WANTED_TOKENS.spacing.s2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  markerColumn: {
    width: MARKER_COLUMN_WIDTH,
    alignItems: 'center',
  },
  dotMarker: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginTop: 4,
  },
  dotMarkerSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  diamondMarker: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
    marginTop: 4,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 18,
    marginTop: 4,
  },
  body: {
    flex: 1,
    paddingLeft: WANTED_TOKENS.spacing.s3,
    paddingBottom: WANTED_TOKENS.spacing.s3,
  },
  endpointLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  endpointName: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  endpointHint: {
    marginTop: 2,
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  directLabel: {
    fontSize: WANTED_TOKENS.type.label2.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  changeButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    paddingVertical: 6,
    borderRadius: WANTED_TOKENS.radius.pill,
    borderWidth: 1,
  },
  changeButtonLabel: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  panel: {
    marginLeft: MARKER_COLUMN_WIDTH + WANTED_TOKENS.spacing.s3,
    marginBottom: WANTED_TOKENS.spacing.s3,
    padding: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    gap: WANTED_TOKENS.spacing.s2,
  },
  panelTitle: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    marginBottom: WANTED_TOKENS.spacing.s1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r5,
    gap: WANTED_TOKENS.spacing.s3,
  },
  optionBody: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  recommended: {
    fontSize: WANTED_TOKENS.type.caption2.size,
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingVertical: 2,
    borderRadius: WANTED_TOKENS.radius.pill,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  optionMeta: {
    marginTop: 2,
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
});

export default RouteWithTransfer;

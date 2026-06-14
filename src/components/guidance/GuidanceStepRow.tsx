/**
 * GuidanceStepRow — one row of the 전체 경로 timeline (claude.ai/design
 * handoff: 28px node + absolute top/bottom rail halves, done=green check,
 * active=blue glow, upcoming=outline, destination=flag).
 */
import React, { memo, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Flag, Footprints, MoveRight, TrainFront } from 'lucide-react-native';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { LineBadge, type LineId } from '@/components/design/LineBadge';
import type { GuidanceStep } from '@/models/guidance';

export type GuidanceStepStatus = 'done' | 'active' | 'upcoming';

interface GuidanceStepRowProps {
  step: GuidanceStep;
  status: GuidanceStepStatus;
  isFirst: boolean;
  isLast: boolean;
}

interface RowContent {
  readonly title: string;
  readonly sub: string;
  readonly lineId: string | null;
}

const contentFor = (step: GuidanceStep): RowContent => {
  switch (step.kind) {
    case 'board':
      return {
        title: `${step.stationName}에서 ${step.lineName} 탑승`,
        sub: step.direction ? `${step.direction} 방면` : '승강장에서 열차를 기다리세요',
        lineId: step.lineId,
      };
    case 'ride':
      return {
        title: `${step.fromStationName} → ${step.toStationName}`,
        sub: `${step.hops.length}개 역 · 약 ${Math.max(1, Math.round(step.durationMinutes))}분`,
        lineId: step.lineId,
      };
    case 'transfer':
      return {
        title: `${step.stationName} 환승`,
        sub: `도보 약 ${Math.max(1, Math.ceil(step.durationMinutes))}분 → ${step.toLineName}${step.direction ? ` ${step.direction} 방면` : ''}`,
        lineId: step.toLineId,
      };
    case 'alight':
      return {
        title: `${step.stationName} 하차`,
        sub: '목적지',
        lineId: null,
      };
  }
};

const META_LABEL: Record<GuidanceStepStatus, string> = {
  done: '완료',
  active: '진행 중',
  upcoming: '',
};

const StepIcon: React.FC<{ step: GuidanceStep; status: GuidanceStepStatus; color: string }> = ({
  step,
  status,
  color,
}) => {
  if (status === 'done') return <Check size={15} color={color} strokeWidth={3} />;
  switch (step.kind) {
    case 'board':
      return <TrainFront size={15} color={color} strokeWidth={2.2} />;
    case 'ride':
      return <MoveRight size={15} color={color} strokeWidth={2.2} />;
    case 'transfer':
      return <Footprints size={15} color={color} strokeWidth={2.2} />;
    case 'alight':
      return <Flag size={15} color={color} strokeWidth={2.2} />;
  }
};

const GuidanceStepRowImpl: React.FC<GuidanceStepRowProps> = ({
  step,
  status,
  isFirst,
  isLast,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const content = contentFor(step);
  const isDest = step.kind === 'alight';

  const nodeBg =
    status === 'done'
      ? semantic.statusPositive
      : status === 'active'
        ? semantic.primaryNormal
        : isDest
          ? semantic.labelStrong
          : semantic.bgBase;
  const iconColor =
    status === 'upcoming' && !isDest ? semantic.labelAlt : semantic.bgBase;
  const railTopColor = status === 'upcoming' ? semantic.lineNormal : semantic.primaryNormal;
  const railBotColor = status === 'done' ? semantic.primaryNormal : semantic.lineNormal;

  return (
    <View
      style={styles.row}
      testID={`guidance-step-${step.id}`}
      accessibilityLabel={`${content.title}, ${content.sub}${META_LABEL[status] ? `, ${META_LABEL[status]}` : ''}`}
    >
      <View style={styles.railColumn}>
        {!isFirst && <View style={[styles.railTop, { backgroundColor: railTopColor }]} />}
        {!isLast && <View style={[styles.railBottom, { backgroundColor: railBotColor }]} />}
        <View
          style={[
            styles.node,
            { backgroundColor: nodeBg },
            status === 'upcoming' && !isDest && styles.nodeOutline,
            status === 'active' && styles.nodeActiveGlow,
          ]}
        >
          <StepIcon step={step} status={status} color={iconColor} />
        </View>
      </View>

      <View style={[styles.content, isLast && styles.contentLast]}>
        <View style={styles.titleRow}>
          {content.lineId !== null && <LineBadge line={content.lineId as LineId} size={18} />}
          <Text
            style={[styles.title, status === 'done' && styles.titleDone]}
            numberOfLines={1}
          >
            {content.title}
          </Text>
          {META_LABEL[status] !== '' && (
            <Text
              style={[styles.meta, status === 'active' ? styles.metaActive : styles.metaDone]}
            >
              {META_LABEL[status]}
            </Text>
          )}
        </View>
        <Text style={[styles.sub, status === 'done' && styles.titleDone]} numberOfLines={1}>
          {content.sub}
        </Text>
      </View>
    </View>
  );
};

export const GuidanceStepRow = memo(GuidanceStepRowImpl);
GuidanceStepRow.displayName = 'GuidanceStepRow';

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 12,
      minHeight: 58,
    },
    railColumn: {
      width: 28,
      alignItems: 'center',
    },
    railTop: {
      position: 'absolute',
      top: 0,
      bottom: '50%',
      width: 3,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    railBottom: {
      position: 'absolute',
      top: '50%',
      bottom: 0,
      width: 3,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    node: {
      width: 28,
      height: 28,
      borderRadius: WANTED_TOKENS.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    nodeOutline: {
      borderWidth: 2,
      borderColor: semantic.lineNormal,
    },
    nodeActiveGlow: {
      shadowColor: semantic.primaryNormal,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 4,
    },
    content: {
      flex: 1,
      paddingBottom: 14,
    },
    contentLast: {
      paddingBottom: 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    title: {
      flexShrink: 1,
      fontSize: 14.5,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.15,
    },
    titleDone: {
      color: semantic.labelAlt,
    },
    meta: {
      marginLeft: 'auto',
      fontSize: 11,
      fontFamily: weightToFontFamily('800'),
    },
    metaActive: {
      color: semantic.primaryNormal,
    },
    metaDone: {
      color: WANTED_TOKENS.status.green700,
    },
    sub: {
      fontSize: 12.5,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
  });

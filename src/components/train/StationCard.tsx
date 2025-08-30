/**
 * Station Card Component
 * Displays individual station information with selection state
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Station } from '../../models/train';

interface StationCardProps {
  station: Station;
  isSelected?: boolean;
  onPress?: () => void;
  showDistance?: boolean;
  distance?: number;
}

export const StationCard: React.FC<StationCardProps> = ({
  station,
  isSelected = false,
  onPress,
  showDistance = false,
  distance,
}) => {
  const getLineColor = (lineId: string): string => {
    // Seoul Subway Line Colors
    const lineColors: Record<string, string> = {
      '1': '#0d3692',  // Line 1 - Blue
      '2': '#00a84d',  // Line 2 - Green  
      '3': '#ef7c1c',  // Line 3 - Orange
      '4': '#00a4e3',  // Line 4 - Light Blue
      '5': '#996cac',  // Line 5 - Purple
      '6': '#cd7c2f',  // Line 6 - Brown
      '7': '#747f00',  // Line 7 - Olive
      '8': '#e6186c',  // Line 8 - Pink
      '9': '#bb8336',  // Line 9 - Gold
      'airport': '#0090d2', // Airport Express
      'bundang': '#fabe00',  // Bundang Line
      'sinbundang': '#d4003b', // Sinbundang Line
    };
    
    return lineColors[lineId] || '#6b7280';
  };

  const formatDistance = (dist: number): string => {
    if (dist < 1) {
      return `${Math.round(dist * 1000)}m`;
    }
    return `${dist.toFixed(1)}km`;
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.selectedContainer,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.stationInfo}>
          <Text style={[styles.stationName, isSelected && styles.selectedText]}>
            {station.name}
          </Text>
          <Text style={styles.stationNameEn}>
            {station.nameEn}
          </Text>
        </View>
        {showDistance && distance !== undefined && (
          <Text style={styles.distance}>
            {formatDistance(distance)}
          </Text>
        )}
      </View>

      <View style={styles.lineInfo}>
        <View 
          style={[
            styles.lineIndicator,
            { backgroundColor: getLineColor(station.lineId) }
          ]}
        />
        <Text style={styles.lineText}>
          {station.lineId}호선
        </Text>
      </View>

      {station.transfers && station.transfers.length > 0 && (
        <View style={styles.transfersContainer}>
          <Ionicons name="shuffle-outline" size={14} color="#6b7280" />
          <Text style={styles.transfersText}>
            환승: {station.transfers.map(lineId => `${lineId}호선`).join(', ')}
          </Text>
        </View>
      )}

      {isSelected && (
        <View style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectedContainer: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  selectedText: {
    color: '#2563eb',
  },
  stationNameEn: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  distance: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  lineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  lineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  lineText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  transfersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  transfersText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
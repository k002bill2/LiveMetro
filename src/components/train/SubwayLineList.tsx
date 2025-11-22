import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SubwayLine } from '../../models/train';
import { trainService } from '../../services/train/trainService';

export const SubwayLineList: React.FC = () => {
  const [lines, setLines] = useState<SubwayLine[]>([]);

  useEffect(() => {
    loadLines();
  }, []);

  const loadLines = async () => {
    try {
      const fetchedLines = await trainService.getSubwayLines();
      if (fetchedLines.length > 0) {
        setLines(fetchedLines);
      } else {
        // Fallback mock data for Seoul Metro lines
        setLines([
          { id: '1', name: '1호선', color: '#0052A4', stations: [] },
          { id: '2', name: '2호선', color: '#00A84D', stations: [] },
          { id: '3', name: '3호선', color: '#EF7C1C', stations: [] },
          { id: '4', name: '4호선', color: '#00A5DE', stations: [] },
          { id: '5', name: '5호선', color: '#996CAC', stations: [] },
          { id: '6', name: '6호선', color: '#CD7C2F', stations: [] },
          { id: '7', name: '7호선', color: '#747F00', stations: [] },
          { id: '8', name: '8호선', color: '#E6186C', stations: [] },
          { id: '9', name: '9호선', color: '#BDB092', stations: [] },
        ]);
      }
    } catch (error) {
      console.error('Failed to load subway lines:', error);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>노선 정보</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {lines.map((line) => (
          <TouchableOpacity 
            key={line.id} 
            style={[styles.card, { borderLeftColor: line.color }]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${line.name}`}
          >
            <View style={[styles.iconContainer, { backgroundColor: line.color }]}>
              <Text style={styles.iconText}>{line.id.replace('호선', '')}</Text>
            </View>
            <Text style={styles.name}>{line.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    minWidth: 100,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  iconText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});

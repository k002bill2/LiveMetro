/**
 * TrainArrivalCard Usage Examples
 * Demonstrates different use cases of the TrainArrivalCard component
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { TrainArrivalCard } from './TrainArrivalCard';
import { Train, TrainStatus } from '@models/train';

/**
 * Example: Normal arriving train
 */
export const NormalTrainExample: React.FC = () => {
  const train: Train = {
    id: 'train-1',
    lineId: '2',
    direction: 'up',
    currentStationId: 'gangnam',
    nextStationId: 'yeoksam',
    status: TrainStatus.NORMAL,
    arrivalTime: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes from now
    delayMinutes: 0,
    lastUpdated: new Date(),
  };

  return (
    <TrainArrivalCard
      train={train}
      stationName="강남"
      lineName="2호선"
      onPress={() => console.log('Train pressed:', train.id)}
    />
  );
};

/**
 * Example: Delayed train
 */
export const DelayedTrainExample: React.FC = () => {
  const train: Train = {
    id: 'train-2',
    lineId: '1',
    direction: 'down',
    currentStationId: 'seoul-station',
    nextStationId: 'city-hall',
    status: TrainStatus.DELAYED,
    arrivalTime: new Date(Date.now() + 8 * 60 * 1000), // 8 minutes from now
    delayMinutes: 5,
    lastUpdated: new Date(),
  };

  return (
    <TrainArrivalCard
      train={train}
      stationName="서울역"
      lineName="1호선"
    />
  );
};

/**
 * Example: Immediately arriving train
 */
export const ImmediateArrivalExample: React.FC = () => {
  const train: Train = {
    id: 'train-3',
    lineId: '3',
    direction: 'up',
    currentStationId: 'apgujeong',
    nextStationId: 'sinsa',
    status: TrainStatus.NORMAL,
    arrivalTime: new Date(Date.now() + 30 * 1000), // 30 seconds from now
    delayMinutes: 0,
    lastUpdated: new Date(),
  };

  return (
    <TrainArrivalCard
      train={train}
      stationName="압구정"
      lineName="3호선"
    />
  );
};

/**
 * Example: Suspended train
 */
export const SuspendedTrainExample: React.FC = () => {
  const train: Train = {
    id: 'train-4',
    lineId: '4',
    direction: 'down',
    currentStationId: 'sadang',
    nextStationId: null,
    status: TrainStatus.SUSPENDED,
    arrivalTime: null,
    delayMinutes: 0,
    lastUpdated: new Date(),
  };

  return (
    <TrainArrivalCard
      train={train}
      stationName="사당"
      lineName="4호선"
    />
  );
};

/**
 * Example: Multiple lines showcase
 */
export const MultiLineShowcase: React.FC = () => {
  const trains: Array<{ train: Train; lineName: string; stationName: string }> = [
    {
      train: {
        id: 'train-line1',
        lineId: '1',
        direction: 'up',
        currentStationId: 'station1',
        nextStationId: 'station2',
        status: TrainStatus.NORMAL,
        arrivalTime: new Date(Date.now() + 2 * 60 * 1000),
        delayMinutes: 0,
        lastUpdated: new Date(),
      },
      lineName: '1호선',
      stationName: '서울역',
    },
    {
      train: {
        id: 'train-line2',
        lineId: '2',
        direction: 'down',
        currentStationId: 'station3',
        nextStationId: 'station4',
        status: TrainStatus.NORMAL,
        arrivalTime: new Date(Date.now() + 4 * 60 * 1000),
        delayMinutes: 0,
        lastUpdated: new Date(),
      },
      lineName: '2호선',
      stationName: '강남',
    },
    {
      train: {
        id: 'train-line3',
        lineId: '3',
        direction: 'up',
        currentStationId: 'station5',
        nextStationId: 'station6',
        status: TrainStatus.DELAYED,
        arrivalTime: new Date(Date.now() + 7 * 60 * 1000),
        delayMinutes: 3,
        lastUpdated: new Date(),
      },
      lineName: '3호선',
      stationName: '신사',
    },
    {
      train: {
        id: 'train-bundang',
        lineId: 'bundang',
        direction: 'down',
        currentStationId: 'station7',
        nextStationId: 'station8',
        status: TrainStatus.NORMAL,
        arrivalTime: new Date(Date.now() + 5 * 60 * 1000),
        delayMinutes: 0,
        lastUpdated: new Date(),
      },
      lineName: '분당선',
      stationName: '선릉',
    },
  ];

  return (
    <ScrollView style={styles.showcase}>
      {trains.map(({ train, lineName, stationName }) => (
        <TrainArrivalCard
          key={train.id}
          train={train}
          lineName={lineName}
          stationName={stationName}
          style={styles.showcaseCard}
        />
      ))}
    </ScrollView>
  );
};

/**
 * Complete example with all features
 */
export const CompleteExample: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <NormalTrainExample />
      </View>

      <View style={styles.section}>
        <DelayedTrainExample />
      </View>

      <View style={styles.section}>
        <ImmediateArrivalExample />
      </View>

      <View style={styles.section}>
        <SuspendedTrainExample />
      </View>

      <View style={styles.section}>
        <MultiLineShowcase />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  section: {
    marginBottom: 24,
  },
  showcase: {
    flex: 1,
  },
  showcaseCard: {
    marginBottom: 12,
  },
});

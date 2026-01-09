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
    finalDestination: '시청',
    status: TrainStatus.NORMAL,
    arrivalTime: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes from now
    delayMinutes: 0,
    lastUpdated: new Date(),
  };

  return (
    <TrainArrivalCard
      train={train}
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
    finalDestination: '인천',
    status: TrainStatus.DELAYED,
    arrivalTime: new Date(Date.now() + 8 * 60 * 1000), // 8 minutes from now
    delayMinutes: 5,
    lastUpdated: new Date(),
  };

  return <TrainArrivalCard train={train} />;
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
    finalDestination: '대화',
    status: TrainStatus.NORMAL,
    arrivalTime: new Date(Date.now() + 30 * 1000), // 30 seconds from now
    delayMinutes: 0,
    lastUpdated: new Date(),
  };

  return <TrainArrivalCard train={train} />;
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
    finalDestination: '오이도',
    status: TrainStatus.SUSPENDED,
    arrivalTime: null,
    delayMinutes: 0,
    lastUpdated: new Date(),
  };

  return <TrainArrivalCard train={train} />;
};

/**
 * Example: Multiple lines showcase
 */
export const MultiLineShowcase: React.FC = () => {
  const trains: Train[] = [
    {
      id: 'train-line1',
      lineId: '1',
      direction: 'up',
      currentStationId: 'station1',
      nextStationId: 'station2',
      finalDestination: '의정부',
      status: TrainStatus.NORMAL,
      arrivalTime: new Date(Date.now() + 2 * 60 * 1000),
      delayMinutes: 0,
      lastUpdated: new Date(),
    },
    {
      id: 'train-line2',
      lineId: '2',
      direction: 'down',
      currentStationId: 'station3',
      nextStationId: 'station4',
      finalDestination: '잠실',
      status: TrainStatus.NORMAL,
      arrivalTime: new Date(Date.now() + 4 * 60 * 1000),
      delayMinutes: 0,
      lastUpdated: new Date(),
    },
    {
      id: 'train-line3',
      lineId: '3',
      direction: 'up',
      currentStationId: 'station5',
      nextStationId: 'station6',
      finalDestination: '대화',
      status: TrainStatus.DELAYED,
      arrivalTime: new Date(Date.now() + 7 * 60 * 1000),
      delayMinutes: 3,
      lastUpdated: new Date(),
    },
    {
      id: 'train-bundang',
      lineId: 'bundang',
      direction: 'down',
      currentStationId: 'station7',
      nextStationId: 'station8',
      finalDestination: '왕십리',
      status: TrainStatus.NORMAL,
      arrivalTime: new Date(Date.now() + 5 * 60 * 1000),
      delayMinutes: 0,
      lastUpdated: new Date(),
    },
  ];

  return (
    <ScrollView style={styles.showcase}>
      {trains.map((train) => (
        <TrainArrivalCard
          key={train.id}
          train={train}
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

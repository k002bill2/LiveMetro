/**
 * TrainArrivalCard Demo Screen
 * Showcases the new TrainArrivalCard component with various states
 */

import React from 'react';
import { ScrollView, View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { TrainArrivalCard } from './src/components/train/TrainArrivalCard';
import { Train, TrainStatus } from './src/models/train';

const TrainCardDemo: React.FC = () => {
  // 정상 운행 중인 2호선 열차
  const normalTrain: Train = {
    id: 'train-1',
    lineId: '2',
    direction: 'up',
    currentStationId: 'gangnam',
    nextStationId: 'yeoksam',
    finalDestination: '시청',
    status: TrainStatus.NORMAL,
    arrivalTime: new Date(Date.now() + 3 * 60 * 1000), // 3분 후
    delayMinutes: 0,
    lastUpdated: new Date(),
  };

  // 지연 중인 1호선 열차
  const delayedTrain: Train = {
    id: 'train-2',
    lineId: '1',
    direction: 'down',
    currentStationId: 'seoul-station',
    nextStationId: 'city-hall',
    finalDestination: '인천',
    status: TrainStatus.DELAYED,
    arrivalTime: new Date(Date.now() + 8 * 60 * 1000), // 8분 후
    delayMinutes: 5,
    lastUpdated: new Date(),
  };

  // 즉시 도착하는 3호선 열차
  const immediateTrain: Train = {
    id: 'train-3',
    lineId: '3',
    direction: 'up',
    currentStationId: 'apgujeong',
    nextStationId: 'sinsa',
    finalDestination: '대화',
    status: TrainStatus.NORMAL,
    arrivalTime: new Date(Date.now() + 30 * 1000), // 30초 후
    delayMinutes: 0,
    lastUpdated: new Date(),
  };

  // 분당선 열차
  const bundangTrain: Train = {
    id: 'train-4',
    lineId: 'bundang',
    direction: 'down',
    currentStationId: 'seolleung',
    nextStationId: 'samsung',
    finalDestination: '왕십리',
    status: TrainStatus.NORMAL,
    arrivalTime: new Date(Date.now() + 5 * 60 * 1000), // 5분 후
    delayMinutes: 0,
    lastUpdated: new Date(),
  };

  // 신분당선 지연 열차
  const shinbundangTrain: Train = {
    id: 'train-5',
    lineId: 'sinbundang',
    direction: 'up',
    currentStationId: 'gangnam',
    nextStationId: 'yangjae',
    finalDestination: '광교',
    status: TrainStatus.DELAYED,
    arrivalTime: new Date(Date.now() + 12 * 60 * 1000), // 12분 후
    delayMinutes: 7,
    lastUpdated: new Date(),
  };

  // 4호선 운행 중단
  const suspendedTrain: Train = {
    id: 'train-6',
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      <View style={styles.header}>
        <Text style={styles.title}>🚇 TrainArrivalCard Demo</Text>
        <Text style={styles.subtitle}>
          Seoul Metro official colors & real-time display
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Normal Trains */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>정상 운행</Text>

          <TrainArrivalCard
            train={normalTrain}
            onPress={() => console.log('2호선 pressed')}
            style={styles.card}
          />

          <TrainArrivalCard
            train={immediateTrain}
            onPress={() => console.log('3호선 pressed')}
            style={styles.card}
          />

          <TrainArrivalCard
            train={bundangTrain}
            onPress={() => console.log('분당선 pressed')}
            style={styles.card}
          />
        </View>

        {/* Section: Delayed Trains */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>지연 운행</Text>

          <TrainArrivalCard
            train={delayedTrain}
            style={styles.card}
          />

          <TrainArrivalCard
            train={shinbundangTrain}
            style={styles.card}
          />
        </View>

        {/* Section: Service Disruption */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>운행 중단</Text>

          <TrainArrivalCard
            train={suspendedTrain}
            style={styles.card}
          />
        </View>

        {/* Multiple Lines Showcase */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>노선 색상 쇼케이스</Text>

          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((lineId) => {
            const demoTrain: Train = {
              id: `demo-${lineId}`,
              lineId,
              direction: 'up',
              currentStationId: 'station',
              nextStationId: 'next',
              finalDestination: '종착역',
              status: TrainStatus.NORMAL,
              arrivalTime: new Date(Date.now() + 4 * 60 * 1000),
              delayMinutes: 0,
              lastUpdated: new Date(),
            };

            return (
              <TrainArrivalCard
                key={lineId}
                train={demoTrain}
                style={styles.card}
              />
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ✨ Built with React Native + TypeScript
          </Text>
          <Text style={styles.footerText}>
            🎨 Seoul Metro Official Colors
          </Text>
          <Text style={styles.footerText}>
            ♿ WCAG 2.1 AA Accessible
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    marginBottom: 12,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
    textAlign: 'center',
  },
});

export default TrainCardDemo;

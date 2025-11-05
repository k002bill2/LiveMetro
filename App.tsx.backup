import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Mock data for demonstration
const stationData = [
  { 
    id: 1, 
    name: '강남역', 
    line: '2호선', 
    lineColor: '#00D84A',
    trains: [
      { destination: '잠실역 방면', arrivalTime: '2분 후', status: '진입' },
      { destination: '신도림역 방면', arrivalTime: '5분 후', status: '접근' }
    ]
  },
  { 
    id: 2, 
    name: '홍대입구역', 
    line: '2호선', 
    lineColor: '#00D84A',
    trains: [
      { destination: '강남역 방면', arrivalTime: '1분 후', status: '도착' },
      { destination: '합정역 방면', arrivalTime: '4분 후', status: '접근' }
    ]
  },
  { 
    id: 3, 
    name: '서울역', 
    line: '1호선', 
    lineColor: '#0052A4',
    trains: [
      { destination: '영등포역 방면', arrivalTime: '3분 후', status: '진입' },
      { destination: '종각역 방면', arrivalTime: '7분 후', status: '접근' }
    ]
  }
];

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home' or 'detail'
  const [selectedStation, setSelectedStation] = useState(null);

  const renderHomeScreen = () => (
    <View style={styles.container}>
      <Text style={styles.title}>🚇 LiveMetro</Text>
      <Text style={styles.subtitle}>실시간 서울 지하철 알림</Text>
      <Text style={styles.description}>Real-time Seoul Subway Notifications</Text>
      
      <View style={styles.stationList}>
        <Text style={styles.sectionTitle}>근처 지하철역</Text>
        {stationData.map((station) => (
          <TouchableOpacity 
            key={station.id}
            style={styles.stationCard}
            onPress={() => {
              setSelectedStation(station);
              setCurrentView('detail');
            }}
          >
            <View style={styles.stationInfo}>
              <Text style={styles.stationName}>{station.name}</Text>
              <View style={[styles.lineIndicator, { backgroundColor: station.lineColor }]}>
                <Text style={styles.lineName}>{station.line}</Text>
              </View>
            </View>
            <Text style={styles.nextTrain}>다음 열차: {station.trains[0]?.arrivalTime}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderDetailScreen = () => (
    <SafeAreaView style={styles.detailContainer}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentView('home')}
        >
          <Text style={styles.backButtonText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>실시간 도착정보</Text>
      </View>

      <View style={styles.stationHeader}>
        <Text style={styles.detailStationName}>{selectedStation?.name}</Text>
        <View style={[styles.detailLineIndicator, { backgroundColor: selectedStation?.lineColor }]}>
          <Text style={styles.detailLineName}>{selectedStation?.line}</Text>
        </View>
      </View>

      <ScrollView style={styles.trainList}>
        <Text style={styles.sectionTitle}>실시간 도착 정보</Text>
        {selectedStation?.trains.map((train, index) => (
          <View key={index} style={styles.trainCard}>
            <View style={styles.trainInfo}>
              <Text style={styles.destination}>{train.destination}</Text>
              <Text style={styles.arrivalTime}>{train.arrivalTime}</Text>
            </View>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: getStatusColor(train.status) }
            ]}>
              <Text style={styles.statusText}>{train.status}</Text>
            </View>
          </View>
        ))}
        
        <View style={styles.additionalInfo}>
          <Text style={styles.infoTitle}>📍 위치 정보</Text>
          <Text style={styles.infoText}>서울특별시 강남구</Text>
          
          <Text style={styles.infoTitle}>🚇 환승 정보</Text>
          <Text style={styles.infoText}>신분당선, 9호선 환승 가능</Text>
          
          <Text style={styles.infoTitle}>⏰ 운행 시간</Text>
          <Text style={styles.infoText}>첫차: 05:30 | 막차: 24:00</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case '도착': return '#f44336';
      case '진입': return '#ff9800';
      case '접근': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  return (
    <>
      {currentView === 'home' ? renderHomeScreen() : renderDetailScreen()}
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    color: '#ffffff',
    marginBottom: 5,
  },
  description: {
    fontSize: 16,
    color: '#bbdefb',
    textAlign: 'center',
    marginBottom: 30,
  },
  stationList: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  stationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  lineIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lineName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  nextTrain: {
    fontSize: 14,
    color: '#666',
  },
  // Detail Screen Styles
  detailContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 40,
  },
  stationHeader: {
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  detailStationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  detailLineIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  detailLineName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  trainList: {
    flex: 1,
    padding: 20,
  },
  trainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  trainInfo: {
    flex: 1,
  },
  destination: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  arrivalTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  additionalInfo: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
});
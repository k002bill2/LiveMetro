export type AppTabParamList = {
  Home: undefined;
  Favorites: undefined;
  Alerts: undefined;
  Settings: undefined;
};

export type AppStackParamList = {
  // Authenticated screens
  MainTabs: undefined;
  StationDetail: {
    stationId: string;
    stationName: string;
    lineId: string;
  };
  StationNavigator: {
    stationId: string;
    lineId: string;
  };

  // Unauthenticated screens
  Welcome: undefined;
  Auth: undefined;
};

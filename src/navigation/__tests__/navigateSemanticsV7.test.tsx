/**
 * React Navigation 7 navigate semantics — integration test against the REAL
 * core + StackRouter/TabRouter (no navigation mocks).
 *
 * 7.x `navigate(name)` pushes a new route even when `name` already exists
 * lower in the stack (6.x popped back to it). The app call sites that relied
 * on the 6.x behavior now pass `pop: true`; these tests pin that the router
 * honors those exact call shapes:
 *   - picker return: navigate(host, { pickedStation }, { merge: true, pop: true })
 *   - root-stack screen → navigate('Main', { screen: 'Profile', params: {...} }, { pop: true })
 *
 * A minimal headless navigator (useNavigationBuilder) is used instead of
 * native-stack/bottom-tabs so no native views are needed — the routing logic
 * under test lives entirely in core + routers.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import {
  BaseNavigationContainer,
  createNavigationContainerRef,
  createNavigatorFactory,
  StackRouter,
  TabRouter,
  useNavigationBuilder,
  type DefaultNavigatorOptions,
  type EventMapBase,
  type NavigationState,
  type ParamListBase,
  type PartialState,
  type StackNavigationState,
  type StackRouterOptions,
  type TabNavigationState,
  type TabRouterOptions,
} from '@react-navigation/native';

type HeadlessStackProps = DefaultNavigatorOptions<
  ParamListBase,
  string | undefined,
  StackNavigationState<ParamListBase>,
  object,
  EventMapBase,
  unknown
> &
  StackRouterOptions;

type HeadlessTabProps = DefaultNavigatorOptions<
  ParamListBase,
  string | undefined,
  TabNavigationState<ParamListBase>,
  object,
  EventMapBase,
  unknown
> &
  TabRouterOptions;

/** Stack renders only the focused route — enough to mount nested navigators. */
function HeadlessStack(props: HeadlessStackProps): React.JSX.Element {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    StackRouter,
    props,
  );
  const focusedKey = state.routes[state.index]?.key ?? '';
  return <NavigationContent>{descriptors[focusedKey]?.render() ?? null}</NavigationContent>;
}

function HeadlessTabs(props: HeadlessTabProps): React.JSX.Element {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(
    TabRouter,
    props,
  );
  // Keep every tab mounted like bottom-tabs does after first focus, so a
  // nested stack keeps its state across tab switches.
  return (
    <NavigationContent>
      {state.routes.map((r) => (
        <React.Fragment key={r.key}>{descriptors[r.key]?.render() ?? null}</React.Fragment>
      ))}
    </NavigationContent>
  );
}

const createHeadlessStack = createNavigatorFactory(HeadlessStack);
const createHeadlessTabs = createNavigatorFactory(HeadlessTabs);

const Stack = createHeadlessStack();
const Tabs = createHeadlessTabs();
const SettingsStack = createHeadlessStack();

const Blank = (): React.JSX.Element => <Text>screen</Text>;

const SettingsNavigator = (): React.JSX.Element => (
  <SettingsStack.Navigator>
    <SettingsStack.Screen name="SettingsHome" component={Blank} />
    <SettingsStack.Screen name="CommuteSettings" component={Blank} />
    <SettingsStack.Screen name="EditCommuteRoute" component={Blank} />
    <SettingsStack.Screen name="EditCommuteStationPicker" component={Blank} />
  </SettingsStack.Navigator>
);

const MainTabs = (): React.JSX.Element => (
  <Tabs.Navigator>
    <Tabs.Screen name="Home" component={Blank} />
    <Tabs.Screen name="Profile" component={SettingsNavigator} />
  </Tabs.Navigator>
);

const App = ({
  navRef,
}: {
  navRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>;
}): React.JSX.Element => (
  <BaseNavigationContainer ref={navRef}>
    <Stack.Navigator>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="WeeklyPrediction" component={Blank} />
    </Stack.Navigator>
  </BaseNavigationContainer>
);

type AnyState = NavigationState | PartialState<NavigationState>;

const routeNames = (state: AnyState | undefined): string[] =>
  (state?.routes ?? []).map((r) => r.name);

const childState = (state: AnyState | undefined, name: string): AnyState | undefined =>
  state?.routes.find((r) => r.name === name)?.state;

const profileStack = (
  navRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>,
): AnyState | undefined =>
  childState(childState(navRef.getRootState(), 'Main'), 'Profile');

const renderApp = (): ReturnType<typeof createNavigationContainerRef<ParamListBase>> => {
  const navRef = createNavigationContainerRef<ParamListBase>();
  render(<App navRef={navRef} />);
  return navRef;
};

/** Seed Profile stack as [SettingsHome, CommuteSettings, EditCommuteRoute(edit params), Picker]. */
const openPickerFromEditRoute = (
  navRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>,
): void => {
  act(() => navRef.navigate('Profile'));
  act(() => navRef.navigate('CommuteSettings'));
  act(() =>
    navRef.navigate('EditCommuteRoute', { kind: 'morning', otherLeg: 'evening-leg' }),
  );
  act(() => navRef.navigate('EditCommuteStationPicker', { selectionType: 'departure' }));
};

describe('React Navigation 7 navigate semantics (real router)', () => {
  it('picker return with { merge, pop } goes back to the existing host and merges params', () => {
    const navRef = renderApp();
    openPickerFromEditRoute(navRef);
    expect(routeNames(profileStack(navRef))).toEqual([
      'SettingsHome',
      'CommuteSettings',
      'EditCommuteRoute',
      'EditCommuteStationPicker',
    ]);

    act(() =>
      navRef.navigate('EditCommuteRoute', { pickedStation: 'S1' }, { merge: true, pop: true }),
    );

    const stack = profileStack(navRef);
    expect(routeNames(stack)).toEqual(['SettingsHome', 'CommuteSettings', 'EditCommuteRoute']);
    expect(stack?.routes[2]?.params).toEqual({
      kind: 'morning',
      otherLeg: 'evening-leg',
      pickedStation: 'S1',
    });
  });

  it('documents the 7.x regression: without pop the host is pushed again and edit params are lost', () => {
    const navRef = renderApp();
    openPickerFromEditRoute(navRef);

    act(() => navRef.navigate('EditCommuteRoute', { pickedStation: 'S1' }, { merge: true }));

    const stack = profileStack(navRef);
    expect(routeNames(stack)).toEqual([
      'SettingsHome',
      'CommuteSettings',
      'EditCommuteRoute',
      'EditCommuteStationPicker',
      'EditCommuteRoute',
    ]);
    expect(stack?.routes[4]?.params).toEqual({ pickedStation: 'S1' });
  });

  it("navigate('Main', nested CommuteSettings, { pop: true }) from a root-stack screen pops back to Main", () => {
    const navRef = renderApp();
    act(() => navRef.navigate('WeeklyPrediction'));
    expect(routeNames(navRef.getRootState())).toEqual(['Main', 'WeeklyPrediction']);

    act(() =>
      navRef.navigate(
        'Main',
        {
          screen: 'Profile',
          params: { screen: 'CommuteSettings', initial: false, pop: true },
        },
        { pop: true },
      ),
    );

    expect(routeNames(navRef.getRootState())).toEqual(['Main']);
    expect(routeNames(profileStack(navRef))).toEqual(['SettingsHome', 'CommuteSettings']);
    expect(navRef.getCurrentRoute()?.name).toBe('CommuteSettings');
  });

  it('nested pop: true returns to a CommuteSettings already deeper in the Profile stack', () => {
    const navRef = renderApp();
    openPickerFromEditRoute(navRef);
    act(() => navRef.navigate('Home'));

    act(() =>
      navRef.navigate('Profile', { screen: 'CommuteSettings', initial: false, pop: true }),
    );

    expect(routeNames(profileStack(navRef))).toEqual(['SettingsHome', 'CommuteSettings']);
    expect(navRef.getCurrentRoute()?.name).toBe('CommuteSettings');
  });

  it('edge: picker return with pop when the host is absent pushes it (no crash)', () => {
    const navRef = renderApp();
    act(() => navRef.navigate('Profile'));
    act(() => navRef.navigate('EditCommuteStationPicker', { selectionType: 'arrival' }));

    act(() =>
      navRef.navigate('EditCommuteRoute', { pickedStation: 'S2' }, { merge: true, pop: true }),
    );

    expect(routeNames(profileStack(navRef))).toEqual([
      'SettingsHome',
      'EditCommuteStationPicker',
      'EditCommuteRoute',
    ]);
  });
});

import React, {useState, useEffect, useReducer} from 'react';
import Pray from './components/Pray';
import Hour from './components/Hour';
import nextPray from './logic/nextPray';
import {testSchedule} from './logic/notification';
import BackgroundTimer from 'react-native-background-timer';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  PermissionsAndroid,
  View,
  Text,
  AppState,
  Image,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Example from './Example';
import {connect} from 'react-redux';
import {MyHeadlessTask} from './index';
import {createTable} from './logic/database';
import {NavigationContainer} from '@react-navigation/native';
import {createDrawerNavigator} from '@react-navigation/drawer';
import MuteSettings from './components/MuteSettings';
import {DrawerContent} from './components/DrawerContent';
import PushNotification from 'react-native-push-notification';
import {changeStylesSides, fetchPraysRequest, store} from './store';
import Method from './components/Method';
import {LogBox} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Languages} from './RTL_support/Languages';
import {Provider} from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
import CircularProgress from './components/CircularProgress';
LogBox.ignoreLogs(['new NativeEventEmitter']); // Ignore log notification by message
const praysNames = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const getRemainSeconds = pray => {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const time = minute * 60 + hour * 3600;
  const prayHour = parseInt(pray.slice(0, 2));
  const prayMinute = parseInt(pray.slice(3, 5));
  const prayTime = prayHour * 3600 + prayMinute * 60;
  if (time < prayTime) {
    return prayTime - time;
  } else {
    return 24 * 3600 - time + prayTime;
  }
};

const isPrayPassed = prayTime => {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const time = minute + hour * 60;
  const prayHour = parseInt(prayTime.slice(0, 2));
  const prayMinute = parseInt(prayTime.slice(3, 5));
  const namazVakti = prayHour * 60 + prayMinute;
  return namazVakti > time;
};

const App = ({praysData, fetchPrays}) => {
  const {t, i18n} = useTranslation();
  const [nextTime, setNextTime] = useState();
  const [nextTimeName, setNextTimeName] = useState('');
  const [seconds, setSeconds] = useState(0);
  const reducer = (state, action) => {
    const pray = action.type;
    return {...state, [pray]: !state[pray]};
  };

  useEffect(() => {
    async function fetchData() {
      let lan = await AsyncStorage.getItem('I18N_LANGUAGE');
      if (!lan) {
        lan = 'en';
      }
      i18n.changeLanguage(lan).then(() => {
        if (lan === 'ar') {
          store.dispatch(changeStylesSides(true));
        } else {
          store.dispatch(changeStylesSides(false));
        }
      });

      let pray;
      for (let i = 0; i < 6; i++) {
        pray = await AsyncStorage.getItem(praysNames[i]);
        if (pray == 'true') {
          send({type: praysNames[i]});
        }
      }
    }
    const requestLocationPermission = async () => {
      //   if (Platform.OS === 'ios') {
      //     getOneTimeLocation();
      //     subscribeLocationLocation();
      //   } else
      // {

      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Access Required',
            message: 'This App needs to Access your location',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          store.dispatch(fetchPraysRequest());
          createTable();
          Example.startService();
          fetchData();
        } else {
          // setLocationStatus('Permission Denied');
        }
      } catch (err) {
        console.warn(err);
      }
    };
    requestLocationPermission();
  }, []);
  useEffect(() => {
    findNextPrayAndSetSeconds();
  }, [praysData]);

  const defaultState = {
    Fajr: false,
    Sunrise: false,
    Dhuhr: false,
    Asr: false,
    Maghrib: false,
    Isha: false,
  };

  const [state, send] = useReducer(reducer, defaultState);

  const findNextPrayAndSetSeconds = () => {
    if (Object.keys(praysData.prays).length) {
      prop = nextPray({praysData});
      setNextTime(prop.nextTime);
      setNextTimeName(prop.nextTimeName);
      const remain = getRemainSeconds(prop.nextTime);
      setSeconds(remain);
    }
  };
  const praysTranslation = [
    t('Fajr'),
    t('Sunrise'),
    t('Dhuhr'),
    t('Asr'),
    t('Maghrib'),
    t('Isha'),
  ];

  const giveOrderedPrays = praysData => {
    return [
      praysData.Fajr,
      praysData.Sunrise,
      praysData.Dhuhr,
      praysData.Asr,
      praysData.Maghrib,
      praysData.Isha,
    ];
  };
  function HomeScreen({navigation}) {
    return (
      <View>
        <View
          style={{
            ...styles.meanScreen,
            flexDirection: praysData.RTL ? 'row-reverse' : 'row',
          }}>
          <Hour
            direction={praysData.RTL}
            nextPray={t([nextTimeName])}
            nextPrayTime={nextTime}
            timer={seconds}
            onTimeUp={findNextPrayAndSetSeconds}
          />
          <CircularProgress
            direction={praysData.RTL}
            prays={giveOrderedPrays(praysData.prays)}
          />
        </View>
        {praysData &&
          praysData.prays &&
          giveOrderedPrays(praysData.prays).map((element, index) => (
            <Pray
              direction={praysData.RTL}
              key={index}
              pray={praysTranslation[index]}
              time={element}
              alarmValue={state[praysNames[index]]}
              onchangeAlarm={() => dispatcher(praysNames[index], element)}
            />
          ))}
      </View>
    );
  }
  const Drawer = createDrawerNavigator();

  const dispatcher = (type, payload) => {
    const bool = !state[pray];
    send({
      type: type,
    });
    const prayTime = payload;
    const pray = type;
    AsyncStorage.setItem(pray, JSON.stringify(!state[pray]));
    if (prayTime && isPrayPassed(prayTime)) {
      let id = 0;
      for (let i = 0; i < 6; i++) {
        if (pray == praysNames[i]) {
          id = i;
        }
      }
      if (bool) {
        testSchedule(
          new Date(Date.now() + getRemainSeconds(prayTime) * 1000),
          pray,
          id,
        );
      } else {
        PushNotification.cancelLocalNotification(id);
      }
    }
  };
  return praysData.loading ? (
    <View>
      <Image source={require('./assets/aksa.jpg')} />
    </View>
  ) : praysData.error ? (
    <Text>{praysData.error}</Text>
  ) : (
    <Provider store={store}>
      <NavigationContainer>
        <Drawer.Navigator drawerContent={props => <DrawerContent {...props} />}>
          <Drawer.Screen name="Silent Pray" component={HomeScreen} />
          <Drawer.Screen
            name="Mute"
            component={MuteSettings}
            options={({navigation}) => ({
              headerLeft: () => (
                <Icon.Button
                  name="arrow-back-outline"
                  color="#000"
                  backgroundColor="#fff"
                  onPress={() => navigation.goBack()}></Icon.Button>
              ),
            })}
          />
          <Drawer.Screen
            name="Method"
            component={Method}
            options={({navigation}) => ({
              headerLeft: () => (
                <Icon.Button
                  name="arrow-back-outline"
                  color="#000"
                  backgroundColor="#fff"
                  onPress={() => navigation.goBack()}></Icon.Button>
              ),
            })}
          />
          <Drawer.Screen
            name="Languages"
            component={Languages}
            options={({navigation}) => ({
              headerLeft: () => (
                <Icon.Button
                  name="arrow-back-outline"
                  color="#000"
                  backgroundColor="#fff"
                  onPress={() => navigation.goBack()}></Icon.Button>
              ),
            })}
          />
        </Drawer.Navigator>
      </NavigationContainer>
    </Provider>
  );
};

const styles = StyleSheet.create({
  meanScreen: {
    margin: 20,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});

const mapStateToProps = state => {
  return {
    praysData: state,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    fetchPrays: () => dispatch(MyHeadlessTask()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(App);

export const startNotificationsFromBackground = async (prays, bool) => {
  //bool means user has changed the method
  let alarm;
  let prayTime;
  if (AppState.currentState == 'background' || bool) {
    for (let i = 0; i < 6; i++) {
      try {
        alarm = await AsyncStorage.getItem(praysNames[i]);
        prayTime = prays[praysNames[i]];
        if (alarm == 'true' && isPrayPassed(prayTime)) {
          testSchedule(
            new Date(Date.now() + getRemainSeconds(prayTime) * 1000),
            //do the notification override the old one
            praysNames[i],
            i,
          );
        }
      } catch (error) {
        console.log(error.message);
      }
    }
  }
};

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AppState,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
} from 'react-native';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import AudioModule, {Note} from 'react-native-note-detectr';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import Controllr, {getFromRGB} from 'react-native-huecontrollr';
import {Light} from 'react-native-huecontrollr/lib/typescript/huecontrollr/data/light/light';
import AsyncStorage from '@react-native-async-storage/async-storage';

const noteMap: Map<Note, Array<number>> = new Map([
  [Note.C, [254, 1, 1]],
  [Note.CSharp, [254, 128, 1]],
  [Note.D, [254, 254, 1]],
  [Note.DSharp, [128, 254, 1]],
  [Note.E, [1, 254, 1]],
  [Note.F, [1, 254, 128]],
  [Note.FSharp, [1, 254, 254]],
  [Note.G, [1, 128, 254]],
  [Note.GSharp, [1, 1, 254]],
  [Note.A, [127, 1, 254]],
  [Note.ASharp, [254, 1, 254]],
  [Note.B, [254, 1, 127]],
]);
const App = () => {
  const APPNAME = 'MusicLights';
  const DEVICENAME = 'TestDevice';
  const IPKEY = 'ipKey';
  const USERNAME_KEY = 'usernameKey';

  const appState = useRef(AppState.currentState);
  const [appActive, setAppActive] = useState(appState.current === 'active');
  const [ip, setIp] = useState<string>();
  const [userName, setUserName] = useState<string>();
  const [cacheHit, setCacheHit] = useState<boolean | undefined>(undefined);
  const [allLights, setAllLights] = useState<Map<Number, Light>>(
    new Map<Number, Light>(),
  );
  const [controllr, setControllr] = useState<Controllr>();
  const [currentNote, setCurrentNote] = useState<Note>();
  const [intervalLength, setIntervalLength] = useState<number>(2000);

  let previousMax = useRef<Note>();
  previousMax.current = Note.A;
  let noteBuffer = useRef<Note[]>();
  noteBuffer.current = [];

  useEffect(() => {
    if (cacheHit === false) {
      //get controller
      Controllr.createWithAutoIpAndUsername(
        APPNAME,
        DEVICENAME,
        (createdController: Controllr) => {
          const setStorage = async () => {
            try {
              await AsyncStorage.setItem(
                USERNAME_KEY,
                createdController.userName,
              );

              await AsyncStorage.setItem(
                IPKEY,
                createdController.bridgeIpAddress,
              );
            } catch (e) {
              console.log(e);
            }
          };
          setStorage();
          setControllr(createdController);
          createdController.lights.getAll(lightResponse => {
            setAllLights(lightResponse);
          });
        },
      );
    } else if (
      cacheHit === true &&
      ip !== undefined &&
      userName !== undefined
    ) {
      const createdController = Controllr.createFromIpAndUser(ip, userName);
      setControllr(createdController);
      createdController.lights.getAll(lightResponse => {
        setAllLights(lightResponse);
      });
    }
  }, [cacheHit, ip, userName]);

  useEffect(() => {
    // set app active listener
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppActive(nextAppState === 'active');
    });

    const getFromCache = async () => {
      try {
        const ipCacheHit = await AsyncStorage.getItem(IPKEY);
        const userNameCacheHit = await AsyncStorage.getItem(USERNAME_KEY);
        if (ipCacheHit) {
          setIp(ipCacheHit);
        }

        if (userNameCacheHit) {
          setUserName(userNameCacheHit);
        }

        setCacheHit(ipCacheHit !== null && userNameCacheHit != null);
      } catch (e) {
        console.log(e);
        setCacheHit(false);
      }
    };
    getFromCache();
    return () => {
      subscription.remove();
    };
  }, []);

  const callApi = useCallback(() => {
    let freqMap: Map<string, number> = new Map();
    noteBuffer.current?.forEach(note => {
      if (freqMap.has(note)) {
        freqMap.set(note, freqMap.get(note)! + 1);
      } else {
        freqMap.set(note, 1);
      }
    });

    let maxCount = -1;
    let maxEl: Note = Note.A;
    freqMap.forEach((count, note) => {
      if (count > maxCount) {
        maxCount = count;
        maxEl = note as Note;
      }
    });

    if (maxEl === previousMax.current) {
      noteBuffer.current = [maxEl];
      return;
    } else {
      previousMax.current = maxEl;
    }
    const rgb = noteMap.get(maxEl);
    setCurrentNote(maxEl);
    if (rgb) {
      const r = rgb[0];
      const g = rgb[1];
      const b = rgb[2];
      allLights.forEach((value, key, _) => {
        if (controllr !== undefined) {
          controllr.lights.putState(key, {
            xy: getFromRGB(r, g, b),
          });
        }
      });
    }
    noteBuffer.current = [maxEl];
  }, [allLights, controllr]);

  useEffect(() => {
    const intervalId = setInterval(callApi, intervalLength);
    return () => {
      clearInterval(intervalId);
    };
  }, [intervalLength, callApi]);

  const isDarkMode = useColorScheme() === 'dark';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <MultiSlider
        min={100}
        max={10000}
        values={[2000]}
        enableLabel={true}
        customLabel={() => <Text>{intervalLength}</Text>}
        onValuesChangeFinish={values => {
          setIntervalLength(values[0]);
        }}
      />
      <Text>{currentNote}</Text>
      <AudioModule
        isAppActive={appActive}
        onNoteDetected={(note: Note) => {
          noteBuffer.current?.push(note);
        }}
      />
    </SafeAreaView>
  );
};

export default App;

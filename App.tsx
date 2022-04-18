import React, {useEffect, useRef, useState} from 'react';
import {
  AppState,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
} from 'react-native';
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
  [Note.A, [127, 1 ,254]],
  [Note.ASharp, [254, 1, 254]],
  [Note.B, [254, 1, 127]],
]);
const App = () => {
  const APPNAME = 'MusicLights';
  const DEVICENAME = 'TestDevice';
  const IPKEY = 'ipKey';
  const USERNAME_KEY = 'usernameKey';

  interface NoteState {
    previousNote: Note | undefined,
    currentNote: Note | undefined
  }
  const appState = useRef(AppState.currentState);
  const [appActive, setAppActive] = useState(appState.current === 'active');
  const [noteState, setNoteState] = useState<NoteState>();
  const [controller, setController] = useState<Controllr>();
  const [allLights, setAllLights] = useState<Map<Number, Light>>();
  const [ip, setIp] = useState<string>();
  const [userName, setUserName] = useState<string>();
  const [cacheHit, setCacheHit] = useState<boolean | undefined>(undefined);
  const [updateCount, setUpdateCount] = useState(0);

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
          setController(createdController);
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
      setController(createdController);
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

  useEffect(() => {
    if (
      controller !== undefined &&
      allLights !== undefined &&
      noteState &&
      noteState.previousNote !== noteState.currentNote &&
      noteState.currentNote
    ) {
      const rgb = noteMap.get(noteState.currentNote);
      if (rgb) {
        const r = rgb[0];
        const g = rgb[1];
        const b = rgb[2];
        allLights.forEach((value, key, _) => {
          controller.lights.putState(key, {
            xy: getFromRGB(r, g, b),
          });
        });
      }
    }
  }, [noteState]);

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
      <Text>{noteState?.currentNote}</Text>
      <AudioModule
        isAppActive={appActive}
        onNoteDetected={(note: Note) => {

          // trying to prevent batching, doesnt work bc async
          const currentUpdateCount = updateCount + 1;
          console.log(currentUpdateCount);
          if (updateCount > 8) {
            setNoteState({
              previousNote: noteState?.currentNote,
              currentNote: note
            })
            setUpdateCount(0);
          }
          setUpdateCount(currentUpdateCount);
        }}
      />
    </SafeAreaView>
  );
};

export default App;

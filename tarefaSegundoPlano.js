import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOME_TAREFA_KEEPALIVE = 'BASTA_KEEPALIVE';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch (e) {}

export const configurarCanais = async () => {
  try {
    await Notifications.setNotificationChannelAsync('basta-sos', {
      name: 'SOS Emergencia',
      importance: Notifications.AndroidImportance.MAX,
      sound: true,
      vibrationPattern: [0, 500, 200, 500],
      showBadge: true,
    });
  } catch (e) {}
};

export const registrarTarefaKeepalive = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(NOME_TAREFA_KEEPALIVE, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (e) {}
};

try {
  TaskManager.defineTask(NOME_TAREFA_KEEPALIVE, async () => {
    try {
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {} 

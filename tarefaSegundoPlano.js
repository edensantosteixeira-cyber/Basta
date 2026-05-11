import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

export const NOME_TAREFA_KEEPALIVE = 'BASTA_KEEPALIVE';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch (e) {}

export const mostrarNotificacaoProtecao = async () => {
  try {
    await Notifications.requestPermissionsAsync();
    await Notifications.scheduleNotificationAsync({
      identifier: 'basta-protecao-ativa',
      content: {
        title: 'Basta — Proteção ativa',
        body: 'Monitorando frase de segurança em segundo plano.',
      },
      trigger: null,
    });
  } catch (e) {}
};

export const removerNotificacaoProtecao = async () => {
  try {
    await Notifications.dismissNotificationAsync('basta-protecao-ativa');
  } catch (e) {}
};

export const configurarCanais = async () => {
  try {
    await Notifications.setNotificationChannelAsync('basta-protecao', {
      name: 'Proteção ativa',
      importance: Notifications.AndroidImportance.LOW,
      sound: false,
      showBadge: false,
    });
    await Notifications.setNotificationChannelAsync('basta-sos', {
      name: 'SOS Emergência',
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
      const fraseAtiva = await AsyncStorage.getItem('@b_frase_ativa');
      if (fraseAtiva === 'true') await mostrarNotificacaoProtecao();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {} 

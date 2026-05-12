import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

export const NOME_TAREFA_KEEPALIVE = 'BASTA_KEEPALIVE';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {}

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

export const mostrarNotificacaoProtecao = async () => {
  try {
    await Notifications.requestPermissionsAsync();
    await Notifications.scheduleNotificationAsync({
      identifier: 'basta-protecao-ativa',
      content: {
        title: 'Basta — Proteção ativa',
        body: 'Monitorando frase de segurança em segundo plano.',
        android: {
          channelId: 'basta-protecao',
          ongoing: true,
          priority: 'low',
          color: '#6B3FA0',
        },
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

export const mostrarNotificacaoSOS = async (contatosAlertados) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🆘 SOS ENVIADO!',
        body: `SMS de emergência enviado para ${contatosAlertados} contato(s)! Mantenha a calma.`,
        android: {
          channelId: 'basta-sos',
          priority: 'max',
          color: '#C8335A',
        },
      },
      trigger: null,
    });
  } catch (e) {}
};

export const enviarSMSSegundoPlano = async () => {
  try {
    const raw = await AsyncStorage.getItem('@b_c_list');
    const contatos = raw ? JSON.parse(raw) : [];
    if (contatos.length === 0) return 0;

    const msg = 'SOS EMERGENCIA - Preciso de ajuda AGORA! Esta mensagem foi enviada automaticamente pelo app Basta.';

    let enviados = 0;
    for (const c of contatos) {
      try {
        const tel = c.tel.replace(/\D/g, '');
        const telFull = tel.startsWith('55') ? tel : '55' + tel;
        await Linking.openURL(`sms:+${telFull}?body=${encodeURIComponent(msg)}`);
        await new Promise(r => setTimeout(r, 1000));
        enviados++;
      } catch (e) {}
    }
    return enviados;
  } catch (e) {
    return 0;
  }
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

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

export const NOME_TAREFA_KEEPALIVE = 'BASTA_KEEPALIVE';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const mostrarNotificacaoProtecao = async () => {
  await Notifications.requestPermissionsAsync();
  await Notifications.scheduleNotificationAsync({
    identifier: 'basta-protecao-ativa',
    content: {
      title: '🛡️ Basta — Proteção ativa',
      body: 'Monitorando frase de segurança em segundo plano.',
      sticky: true,
      autoDismiss: false,
      android: {
        channelId: 'basta-protecao',
        ongoing: true,
        priority: 'low',
        color: '#6B3FA0',
      },
    },
    trigger: null,
  });
};

export const removerNotificacaoProtecao = async () => {
  await Notifications.dismissNotificationAsync('basta-protecao-ativa');
};

export const configurarCanais = async () => {
  await Notifications.setNotificationChannelAsync('basta-protecao', {
    name: 'Proteção ativa',
    importance: Notifications.AndroidImportance.LOW,
    sound: false,
    vibrationPattern: null,
    showBadge: false,
  });
  await Notifications.setNotificationChannelAsync('basta-sos', {
    name: 'SOS Emergência',
    importance: Notifications.AndroidImportance.MAX,
    sound: true,
    vibrationPattern: [0, 500, 200, 500],
    showBadge: true,
  });
};

export const acionarSOSSegundoPlano = async () => {
  try {
    const raw = await AsyncStorage.getItem('@b_c_list');
    const contatos = raw ? JSON.parse(raw) : [];
    if (contatos.length === 0) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🆘 Basta — SOS ACIONADO',
        body: `Enviando para ${contatos.length} contato(s)...`,
        android: { channelId: 'basta-sos', priority: 'max' },
      },
      trigger: null,
    });
    for (const c of contatos) {
      const tel = c.tel.replace(/\D/g, '');
      const telFull = tel.startsWith('55') ? tel : '55' + tel;
      const msg = 'SOS EMERGÊNCIA - Preciso de ajuda AGORA! - App Basta';
      await Linking.openURL(`whatsapp://send?phone=%2B${telFull}&text=${encodeURIComponent(msg)}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch (e) {}
};

TaskManager.defineTask(NOME_TAREFA_KEEPALIVE, async () => {
  try {
    const fraseAtiva = await AsyncStorage.getItem('@b_frase_ativa');
    if (fraseAtiva === 'true') await mostrarNotificacaoProtecao();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registrarTarefaKeepalive = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(NOME_TAREFA_KEEPALIVE, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (e) {}
};

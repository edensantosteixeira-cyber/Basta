import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Linking, Alert, Animated, ScrollView, StatusBar, TextInput,
  Image, Modal, Switch, ActivityIndicator, Platform, Share, Vibration
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer } from 'expo-sensors';
import CalculadoraCamuflada from './CalculadoraCamuflada';
import MapaDelegacias from './MapaDelegacias';
import {
  configurarCanais,
  registrarTarefaKeepalive,
} from './tarefaSegundoPlano';

const LOGO = require('./assets/basta_logo.png');

const ROXO     = '#6B3FA0';
const ROXO_ESC = '#3A1F6E';
const ROXO_MED = '#5A2D8A';
const ROSE     = '#C8335A';
const FUNDO    = '#F9F3F6';
const VERDE    = '#1E7A5A';

const GRAD   = ['#3A1F6E', '#6B3FA0', '#8B55C0', '#5A2D8A'];
const GRAD_L = [0, 0.45, 0.75, 1];

const FRASES_PADRAO = [
  'tá tudo bem por aqui',
  'ta tudo bem por aqui',
  'estou bem obrigada',
  'que saudade de casa',
  'vou ligar mais tarde',
];

const gerarHash = async (texto, timestamp) => {
  const payload = JSON.stringify({ texto, timestamp });
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
};

const LogoBasta = ({ size = 44 }) => (
  <Image
    source={LOGO}
    style={{ width: size, height: size, borderRadius: size * 0.18 }}
    resizeMode="contain"
  />
);

export default function App() {
  const [tela, setTela] = useState('home');
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [itens, setItens] = useState([]);
  const [relato, setRelato] = useState('');
  const [listaContatos, setListaContatos] = useState([]);
  const [tempNome, setTempNome] = useState('');
  const [tempTel, setTempTel] = useState('');
  const [fotoFull, setFotoFull] = useState(null);
  const [audioAtual, setAudioAtual] = useState(null);
  const [tocandoId, setTocandoId] = useState(null);
  const [usarGPS, setUsarGPS] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [stepSalvando, setStepSalvando] = useState('');
  const [expandidoId, setExpandidoId] = useState(null);
  const [localizacaoAtiva, setLocalizacaoAtiva] = useState(false);
  const [fraseCodigoAtiva, setFraseCodigoAtiva] = useState(false);
  const [vozStatus, setVozStatus] = useState('');
  const [sosAtivado, setSosAtivado] = useState(false);
  const [sosMensagem, setSosMensagem] = useState('');
  const [gravandoRapido, setGravandoRapido] = useState(false);
  const [gravacaoRapida, setGravacaoRapida] = useState(null);
  const [frases, setFrases] = useState(FRASES_PADRAO);
  const [novaFrase, setNovaFrase] = useState('');
  const [editandoFrase, setEditandoFrase] = useState(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [showGerenciarFrases, setShowGerenciarFrases] = useState(false);
  const [modalEvidencia, setModalEvidencia] = useState(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulso1 = useRef(new Animated.Value(1)).current;
  const pulso2 = useRef(new Animated.Value(1)).current;
  const pulso3 = useRef(new Animated.Value(1)).current;
  const locSubscription = useRef(null);
  const ultimaLocalizacao = useRef(null);
  const vozRecognition = useRef(null);
  const fraseCodigoAtivaRef = useRef(false);
  const shakeCountRef = useRef(0);
  const shakeTimerRef = useRef(null);
  const ultimoShakeRef = useRef(0);
  const reiniciandoRef = useRef(false);
  const frasesRef = useRef(FRASES_PADRAO);

  useEffect(() => { frasesRef.current = frases; }, [frases]);

  useEffect(() => {
    iniciarPulso();
    iniciarDeteccaoShake();
    carregarDados();
    configurarCanais();
    registrarTarefaKeepalive();
    AsyncStorage.getItem('@b_frase_ativa').then(val => {
      if (val === 'true') {
        setFraseCodigoAtiva(true);
        fraseCodigoAtivaRef.current = true;
        setVozStatus('Escutando...');
        iniciarEscutaVoz();
      }
    });
    return () => {
      pararLocalizacaoContinua();
      pararEscutaVoz();
      Accelerometer.removeAllListeners();
    };
  }, []);

  useEffect(() => { fraseCodigoAtivaRef.current = fraseCodigoAtiva; }, [fraseCodigoAtiva]);

  const iniciarPulso = () => {
    const animar = (v, d) => Animated.loop(Animated.sequence([
      Animated.delay(d),
      Animated.timing(v, { toValue: 1.9, duration: 1800, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 0, useNativeDriver: true }),
    ])).start();
    animar(pulso1, 0); animar(pulso2, 500); animar(pulso3, 1000);
  };

  const animarProgresso = (ate) =>
    Animated.timing(progressAnim, { toValue: ate, duration: 350, useNativeDriver: false }).start();

  const carregarDados = async () => {
    try {
      const d = await AsyncStorage.getItem('@b_d');
      const c = await AsyncStorage.getItem('@b_c_list');
      const f = await AsyncStorage.getItem('@b_frases');
      if (d) setItens(JSON.parse(d));
      if (c) setListaContatos(JSON.parse(c));
      if (f) {
        const frasesCarregadas = JSON.parse(f);
        setFrases(frasesCarregadas);
        frasesRef.current = frasesCarregadas;
      }
    } catch (e) {}
  };

  const salvarFrases = async (lista) => {
    setFrases(lista);
    frasesRef.current = lista;
    await AsyncStorage.setItem('@b_frases', JSON.stringify(lista));
  };

  const adicionarFrase = async () => {
    const texto = novaFrase.trim().toLowerCase();
    if (!texto) return;
    if (frases.includes(texto)) { Alert.alert('Já existe', 'Essa frase já está na lista.'); return; }
    await salvarFrases([...frases, texto]);
    setNovaFrase('');
    Alert.alert('Frase adicionada!', '"' + texto + '" será monitorada.');
  };

  const salvarEdicaoFrase = async () => {
    if (editandoFrase === null) return;
    const texto = textoEdicao.trim().toLowerCase();
    if (!texto) return;
    const nova = [...frases];
    nova[editandoFrase] = texto;
    await salvarFrases(nova);
    setEditandoFrase(null);
    setTextoEdicao('');
  };

  const excluirFrase = async (index) => Alert.alert('Remover frase', 'Tem certeza?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: async () => await salvarFrases(frases.filter((_, i) => i !== index)) }
  ]);

  const iniciarLocalizacaoContinua = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos da localização para o SOS.'); return; }
      await Location.requestBackgroundPermissionsAsync();
      locSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
        (loc) => { ultimaLocalizacao.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }; }
      );
      setLocalizacaoAtiva(true);
    } catch (e) {}
  };

  const pararLocalizacaoContinua = () => {
    if (locSubscription.current) { locSubscription.current.remove(); locSubscription.current = null; }
    setLocalizacaoAtiva(false);
  };

  const toggleLocalizacao = () => { if (localizacaoAtiva) pararLocalizacaoContinua(); else iniciarLocalizacaoContinua(); };

  const obterLocalizacaoAtual = async () => {
    if (ultimaLocalizacao.current) return ultimaLocalizacao.current;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch (e) { return null; }
  };

  const iniciarDeteccaoShake = () => {
    Accelerometer.setUpdateInterval(100);
    Accelerometer.addListener(({ x, y, z }) => {
      const forca = Math.sqrt(x * x + y * y + z * z);
      const agora = Date.now();
      if (forca > 2.5 && agora - ultimoShakeRef.current > 500) {
        ultimoShakeRef.current = agora;
        shakeCountRef.current += 1;
        Vibration.vibrate(50);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        if (shakeCountRef.current >= 3) {
          shakeCountRef.current = 0;
          acionarSOSDiscreto();
        } else {
          shakeTimerRef.current = setTimeout(() => {
            shakeCountRef.current = 0;
          }, 2000);
        }
      }
    });
  };



  const acionarSOSDiscreto = async () => {
    Vibration.vibrate([0, 300, 100, 300, 100, 300]);
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (_) {}
    await acionarSOSCompleto(false);
  };

  const toggleFraseCodigo = async () => {
    if (fraseCodigoAtiva) {
      fraseCodigoAtivaRef.current = false;
      pararEscutaVoz();
      setFraseCodigoAtiva(false);
      setVozStatus('');
      await AsyncStorage.setItem('@b_frase_ativa', 'false');
    } else {
      fraseCodigoAtivaRef.current = true;
      setFraseCodigoAtiva(true);
      setVozStatus('Ativando escuta...');
      await AsyncStorage.setItem('@b_frase_ativa', 'true');
      await iniciarEscutaVoz();
    }
  };

  const iniciarEscutaVoz = async () => {
    if (reiniciandoRef.current) return;
    reiniciandoRef.current = true;

    try {
      const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');

      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Precisamos do microfone para a frase-código.');
        fraseCodigoAtivaRef.current = false;
        setFraseCodigoAtiva(false);
        await AsyncStorage.setItem('@b_frase_ativa', 'false');
        reiniciandoRef.current = false;
        return;
      }

      // Remove listeners anteriores para evitar duplicatas
      try {
        ExpoSpeechRecognitionModule.removeAllListeners('result');
        ExpoSpeechRecognitionModule.removeAllListeners('end');
        ExpoSpeechRecognitionModule.removeAllListeners('error');
      } catch (_) {}

      // Listener de resultado — detecta a frase
      ExpoSpeechRecognitionModule.addListener('result', async (event) => {
        try {
          const transcript = event.results
            .map(r => r.transcript.toLowerCase().trim())
            .join(' ');

          if (transcript) {
            setVozStatus('Ouvi: "' + transcript.slice(-40) + '"');
          }

          const frasesAtivas = frasesRef.current;
          const detectada = frasesAtivas.find(f =>
            transcript.includes(f.toLowerCase().trim())
          );

          if (detectada) {
            try { ExpoSpeechRecognitionModule.stop(); } catch (_) {}
            fraseCodigoAtivaRef.current = false;

            setVozStatus('Frase detectada! Acionando SOS...');
            Vibration.vibrate([0, 500, 200, 500, 200, 500]);
            try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (_) {}

            await acionarSOSCompleto(true);

            setFraseCodigoAtiva(false);
            setVozStatus('');
            await AsyncStorage.setItem('@b_frase_ativa', 'false');
                }
        } catch (_) {}
      });

      // Listener de fim — reinicia automaticamente se ainda ativo
      ExpoSpeechRecognitionModule.addListener('end', async () => {
        reiniciandoRef.current = false;
        const aindaAtiva = await AsyncStorage.getItem('@b_frase_ativa');
        if (aindaAtiva === 'true' && fraseCodigoAtivaRef.current) {
          setVozStatus('Escutando...');
          setTimeout(() => iniciarEscutaVoz(), 800);
        }
      });

      // Listener de erro — reinicia em qualquer erro
      ExpoSpeechRecognitionModule.addListener('error', async (event) => {
        reiniciandoRef.current = false;
        const aindaAtiva = await AsyncStorage.getItem('@b_frase_ativa');
        if (aindaAtiva === 'true' && fraseCodigoAtivaRef.current) {
          setVozStatus('Escutando...');
          setTimeout(() => iniciarEscutaVoz(), 1500);
        }
      });

      // Inicia o reconhecimento
      ExpoSpeechRecognitionModule.start({
        lang: 'pt-BR',
        continuous: true,
        interimResults: true,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        contextualStrings: frasesRef.current,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 5000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 5000,
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 1000,
        },
        foregroundService: {
          notificationTitle: 'Basta — Proteção ativa',
          notificationDescription: 'Monitorando frase de segurança.',
          notificationColor: '#6B3FA0',
        },
      });

      vozRecognition.current = ExpoSpeechRecognitionModule;
      setVozStatus('Escutando...');
      reiniciandoRef.current = false;

    } catch (e) {
      reiniciandoRef.current = false;
      setVozStatus('Escutando...');
      const aindaAtiva = await AsyncStorage.getItem('@b_frase_ativa');
      if (aindaAtiva === 'true' && fraseCodigoAtivaRef.current) {
        setTimeout(() => iniciarEscutaVoz(), 2000);
      }
    }
  };

  const pararEscutaVoz = () => {
    try {
      const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
      ExpoSpeechRecognitionModule.stop();
      ExpoSpeechRecognitionModule.removeAllListeners('result');
      ExpoSpeechRecognitionModule.removeAllListeners('end');
      ExpoSpeechRecognitionModule.removeAllListeners('error');
    } catch (_) {}
    vozRecognition.current = null;
    reiniciandoRef.current = false;
  };

  const acionarSOSCompleto = async () => {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (e) {}
    setSosAtivado(true); setSosMensagem('Acionando ajuda...');

    const gps = await obterLocalizacaoAtual();
    const linkMaps = gps ? 'https://maps.google.com/?q=' + gps.latitude + ',' + gps.longitude : 'Localizacao nao disponivel';
    const msgTexto = 'SOS EMERGENCIA - Preciso de ajuda AGORA! Localizacao: ' + linkMaps + ' - App Basta';
    const contatos = listaContatos.length > 0 ? listaContatos : JSON.parse(await AsyncStorage.getItem('@b_c_list') || '[]');

    let enviados = 0;
    for (let i = 0; i < contatos.length; i++) {
      const c = contatos[i];
      setSosMensagem('Enviando para ' + c.nome + '... (' + (i + 1) + '/' + contatos.length + ')');
      const tel = c.tel.replace(/\D/g, '');
      const telFull = tel.startsWith('55') ? tel : '55' + tel;
      try {
        const url = 'whatsapp://send?phone=%2B' + telFull + '&text=' + encodeURIComponent(msgTexto);
        await Linking.openURL(url);
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {}
      Vibration.vibrate(300);
      enviados++;
    }

    setSosMensagem(enviados + ' contato(s) alertado(s) via WhatsApp!');
    Vibration.vibrate(500);
    setTimeout(() => { setSosAtivado(false); setSosMensagem(''); }, 5000);
  };

  const enviarSOS = async () => {
    if (listaContatos.length === 0) {
      Alert.alert('Sem contatos!', 'Cadastre ao menos um contato de emergência.', [
        { text: 'Adicionar agora', onPress: () => setTela('contatos') },
        { text: 'Cancelar', style: 'cancel' }
      ]);
      return;
    }
    await acionarSOSCompleto();
  };

  const iniciarGravacaoRapida = async () => {
    try {
      if (gravandoRapido && gravacaoRapida) {
        setGravandoRapido(false);
        await gravacaoRapida.stopAndUnloadAsync();
        const uri = gravacaoRapida.getURI();
        setGravacaoRapida(null);
        const timestamp = new Date().toISOString();
        const hash = await gerarHash(uri + timestamp, timestamp);
        const novoItem = { id: Date.now().toString(), tipo: 'audio', data: new Date().toLocaleString('pt-BR'), timestamp, hash, conteudo: uri };
        const lista = [novoItem, ...itens];
        setItens(lista);
        await AsyncStorage.setItem('@b_d', JSON.stringify(lista));
        Vibration.vibrate(200);
        Alert.alert('Audio salvo!', 'Gravacao salva no Diario com blindagem.');
        return;
      }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setGravacaoRapida(recording); setGravandoRapido(true); Vibration.vibrate(100);
    } catch (e) { Alert.alert('Erro', 'Nao foi possivel iniciar gravacao.'); }
  };

  const salvarNovoContato = async () => {
    if (!tempNome || !tempTel) return Alert.alert('Erro', 'Preencha nome e telefone.');
    const novaLista = [...listaContatos, { id: Date.now().toString(), nome: tempNome, tel: tempTel }];
    setListaContatos(novaLista);
    await AsyncStorage.setItem('@b_c_list', JSON.stringify(novaLista));
    setTempNome(''); setTempTel('');
    Alert.alert('Contato adicionado!', tempNome + ' foi salvo.');
  };

  const excluirContato = async (id) => Alert.alert('Remover contato', 'Tem certeza?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: async () => {
      const novaLista = listaContatos.filter(c => c.id !== id);
      setListaContatos(novaLista);
      await AsyncStorage.setItem('@b_c_list', JSON.stringify(novaLista));
    }}
  ]);

  const montarTextoEvidencia = (item) => [
    'REGISTRO DE EVIDENCIA — APP BASTA',
    '─────────────────────────────────────',
    'Data: ' + item.data,
    item.gps ? 'GPS: ' + item.gps.latitude.toFixed(6) + ', ' + item.gps.longitude.toFixed(6) : '',
    'Tipo: ' + item.tipo,
    '', 'CONTEUDO:',
    item.tipo === 'texto' ? item.conteudo : '[Arquivo de ' + item.tipo + ' registrado]',
    '', '─────────────────────────────────────',
    'BLINDAGEM CRIPTOGRAFICA:',
    'Hash SHA-256: ' + (item.hash || 'N/A'),
    'Carimbo: ' + (item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : item.data),
    '', 'Gerado pelo app Basta.',
  ].filter(Boolean).join('\n');

  const salvarItem = async (tipo, conteudoUri, textoRelato) => {
    setSalvando(true); progressAnim.setValue(0);
    try {
      setStepSalvando('Carimbando data e hora...'); animarProgresso(20);
      const timestamp = new Date().toISOString();
      await new Promise(r => setTimeout(r, 350));
      let gps = null;
      if (usarGPS) { setStepSalvando('Obtendo localizacao GPS...'); animarProgresso(45); gps = await obterLocalizacaoAtual(); }
      setStepSalvando('Gerando hash SHA-256...'); animarProgresso(70);
      const hash = await gerarHash(tipo === 'texto' ? textoRelato : (conteudoUri + timestamp), timestamp);
      await new Promise(r => setTimeout(r, 300));
      setStepSalvando('Salvando com seguranca...'); animarProgresso(90);
      const novoItem = { id: Date.now().toString(), tipo, data: new Date().toLocaleString('pt-BR'), timestamp, hash, gps, conteudo: conteudoUri || textoRelato };
      const lista = [novoItem, ...itens];
      setItens(lista); await AsyncStorage.setItem('@b_d', JSON.stringify(lista));
      animarProgresso(100); setStepSalvando('Blindado!');
      await new Promise(r => setTimeout(r, 500));
      setSalvando(false); return novoItem;
    } catch (e) { setSalvando(false); Alert.alert('Erro', 'Nao foi possivel salvar.'); return null; }
  };

  const camera = async (tipo) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Erro', 'Sem permissao de camera');
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: tipo === 'foto' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.5
    });
    if (!res.canceled) await salvarItem(tipo, res.assets[0].uri, null);
  };

  const salvarRelato = async () => {
    if (!relato.trim()) return Alert.alert('Atencao', 'Escreva algo antes de salvar.');
    const resultado = await salvarItem('texto', null, relato.trim());
    if (resultado) { setRelato(''); Alert.alert('Registro blindado!', 'Salvo!'); }
  };

  const excluirItem = async (id) => Alert.alert('Apagar registro', 'Tem certeza?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Apagar', style: 'destructive', onPress: async () => {
      const nova = itens.filter(x => x.id !== id);
      setItens(nova); await AsyncStorage.setItem('@b_d', JSON.stringify(nova));
    }}
  ]);

  const tocarAudio = async (uri, id) => {
    try {
      if (audioAtual) { await audioAtual.unloadAsync(); setAudioAtual(null); if (tocandoId === id) { setTocandoId(null); return; } }
      const { sound } = await Audio.Sound.createAsync({ uri });
      setAudioAtual(sound); setTocandoId(id); await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(st => { if (st.didJustFinish) { setTocandoId(null); setAudioAtual(null); } });
    } catch (e) { Alert.alert('Erro', 'Nao foi possivel reproduzir.'); }
  };

  const verificarIntegridade = async (item) => {
    const hashAtual = await gerarHash(item.conteudo, item.timestamp);
    const valido = hashAtual === item.hash;
    Alert.alert(valido ? 'Evidencia integra' : 'Registro alterado', valido ? 'Hash SHA-256 confere. Evidencia valida.' : 'Hash nao confere. Possivel adulteracao.');
  };

  if (!desbloqueado) return <CalculadoraCamuflada onDesbloquear={() => { setDesbloqueado(true); carregarDados(); }} />;
  if (tela === 'mapa') return <MapaDelegacias onVoltar={() => setTela('home')} />;

  const renderHeader = (titulo, subtitulo) => (
    <LinearGradient colors={GRAD} locations={GRAD_L} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.telaHeader}>
      <TouchableOpacity onPress={() => setTela('home')} style={s.voltarBtn}><Text style={s.voltarTxt}>← Voltar</Text></TouchableOpacity>
      <View style={s.telaLogoRow}>
        <LogoBasta size={32} />
        <Text style={s.telaTitulo}>{titulo}</Text>
      </View>
      {subtitulo ? <Text style={s.telaSlogan}>{subtitulo}</Text> : null}
    </LinearGradient>
  );

  const ModalEvidencia = () => {
    if (!modalEvidencia) return null;
    const item = modalEvidencia;
    const texto = montarTextoEvidencia(item);
    return (
      <Modal visible={!!modalEvidencia} transparent animationType="slide" onRequestClose={() => setModalEvidencia(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitulo}>Salvar evidencia</Text>
            <Text style={s.modalSub}>Como deseja guardar este registro?</Text>
            {[
              { ico: '📧', txt: 'E-mail', sub: 'Enviar copia para seu e-mail seguro', fn: async () => {
                setModalEvidencia(null); Vibration.vibrate(100);
                try {
                  const ok = await MailComposer.isAvailableAsync();
                  if (!ok) await Linking.openURL('mailto:?subject=' + encodeURIComponent('Evidencia — App Basta') + '&body=' + encodeURIComponent(texto));
                  else await MailComposer.composeAsync({ subject: 'Evidencia — App Basta', body: texto, isHtml: false });
                } catch (e) { Alert.alert('Erro', 'Nao foi possivel abrir o e-mail.'); }
              }},
              { ico: '💬', txt: 'WhatsApp', sub: 'Enviar para contato de confianca', fn: async () => {
                setModalEvidencia(null); Vibration.vibrate(100);
                await Linking.openURL('whatsapp://send?text=' + encodeURIComponent(texto));
              }},
              { ico: '📤', txt: 'Outros', sub: 'Drive, Telegram, salvar arquivo...', fn: async () => {
                setModalEvidencia(null); Vibration.vibrate(100);
                await Share.share({ message: texto, title: 'Evidencia — App Basta' });
              }},
            ].map((op, i) => (
              <TouchableOpacity key={i} style={s.modalOpcao} onPress={op.fn}>
                <Text style={s.modalOpcaoIco}>{op.ico}</Text>
                <View style={s.modalOpcaoInfo}>
                  <Text style={s.modalOpcaoTxt}>{op.txt}</Text>
                  <Text style={s.modalOpcaoSub}>{op.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.modalVoltar} onPress={() => setModalEvidencia(null)}>
              <Text style={s.modalVoltarTxt}>← Voltar para o diario</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (tela === 'diario') {
    return (
      <SafeAreaView style={s.base}>
        <StatusBar barStyle="light-content" backgroundColor={ROXO_ESC} />
        {renderHeader('Diario', 'Registre incidentes com provas blindadas')}
        <ScrollView style={s.conteudo} keyboardShouldPersistTaps="handled">
          <View style={s.botoesMedia}>
            <TouchableOpacity onPress={() => camera('foto')} style={s.btnMedia} disabled={salvando}><Text style={s.btnMediaIco}>📸</Text><Text style={s.btnMediaTxt}>Foto</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => camera('video')} style={s.btnMedia} disabled={salvando}><Text style={s.btnMediaIco}>🎥</Text><Text style={s.btnMediaTxt}>Video</Text></TouchableOpacity>
          </View>
          <TextInput style={s.inputRelato} placeholder="Relate o ocorrido com detalhes..." placeholderTextColor="#C0A0A8" value={relato} onChangeText={setRelato} multiline numberOfLines={5} textAlignVertical="top" editable={!salvando} />
          <View style={s.blindagemCard}>
            <Text style={s.blindagemTitulo}>🔒 Blindagem automatica</Text>
            <View style={s.toggleLinha}><View style={s.toggleInfo}><Text style={s.toggleLabel}>Carimbo de tempo</Text><Text style={s.toggleSub}>Data e hora imutaveis</Text></View><View style={s.tagAtivo}><Text style={s.tagAtivoTxt}>Sempre ativo</Text></View></View>
            <View style={s.toggleLinha}><View style={s.toggleInfo}><Text style={s.toggleLabel}>Hash SHA-256</Text><Text style={s.toggleSub}>Prova que o conteudo nao foi alterado</Text></View><View style={s.tagAtivo}><Text style={s.tagAtivoTxt}>Sempre ativo</Text></View></View>
            <View style={[s.toggleLinha, { borderBottomWidth: 0 }]}><View style={s.toggleInfo}><Text style={s.toggleLabel}>Localizacao GPS</Text><Text style={s.toggleSub}>Registra onde o relato foi feito</Text></View><Switch value={usarGPS} onValueChange={setUsarGPS} thumbColor="white" trackColor={{ true: ROXO, false: '#E0C0C8' }} /></View>
          </View>
          {salvando && (
            <View style={s.salvandoBox}>
              <ActivityIndicator color={ROXO} size="small" />
              <Text style={s.salvandoTxt}>{stepSalvando}</Text>
              <View style={s.progressBar}><Animated.View style={[s.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} /></View>
            </View>
          )}
          <TouchableOpacity onPress={salvarRelato} disabled={salvando} style={{ marginBottom: 12 }}>
            <LinearGradient colors={[ROXO_MED, ROXO]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
              <Text style={s.btnGradTxt}>{salvando ? 'Blindando...' : '🔒 Salvar com blindagem'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={s.dicaBackup}><Text style={s.dicaBackupTxt}>💡 Apos salvar, toque em "Salvar evidencia" para enviar copia.</Text></View>
          {itens.length === 0 ? (
            <View style={s.emptyBox}><Text style={s.emptyIco}>📋</Text><Text style={s.emptyTxt}>Nenhum registro ainda.</Text><Text style={s.emptySubTxt}>Seus registros sao salvos com seguranca.</Text></View>
          ) : itens.map(item => (
            <View key={item.id} style={s.itemCard}>
              <View style={s.itemTopo}>
                <Text style={s.itemData}>🕐 {item.data}</Text>
                <TouchableOpacity onPress={() => excluirItem(item.id)} style={s.lixeiraBtn}><Text style={s.lixeiraIco}>🗑️</Text></TouchableOpacity>
              </View>
              <View style={s.badgesRow}>
                {item.hash && <View style={s.badgeHash}><Text style={s.badgeHashTxt}>SHA-256</Text></View>}
                {item.gps && <View style={s.badgeGPS}><Text style={s.badgeGPSTxt}>📍 GPS</Text></View>}
                {item.timestamp && <View style={s.badgeTime}><Text style={s.badgeTimeTxt}>⏱ Carimbado</Text></View>}
              </View>
              {item.tipo === 'texto' && <Text style={s.itemTexto}>{item.conteudo}</Text>}
              {item.tipo === 'foto' && (<TouchableOpacity onPress={() => setFotoFull(item.conteudo)}><Image source={{ uri: item.conteudo }} style={s.itemFoto} /><Text style={s.itemDica}>Toque para ampliar</Text></TouchableOpacity>)}
              {item.tipo === 'audio' && (<TouchableOpacity onPress={() => tocarAudio(item.conteudo, item.id)} style={s.audioBtn}><Text style={s.audioIco}>{tocandoId === item.id ? '⏹️' : '▶️'}</Text><Text style={s.audioTxt}>{tocandoId === item.id ? 'Tocando...' : 'Toque para ouvir'}</Text></TouchableOpacity>)}
              {item.tipo === 'video' && (<View style={s.videoCard}><Text style={s.videoIco}>🎥</Text><Text style={s.videoTxt}>Video gravado</Text></View>)}
              {item.hash && (<TouchableOpacity onPress={() => setExpandidoId(expandidoId === item.id ? null : item.id)} style={s.hashToggle}><Text style={s.hashToggleTxt}>{expandidoId === item.id ? '▲ Ocultar' : '▼ Ver hash SHA-256'}</Text></TouchableOpacity>)}
              {expandidoId === item.id && (
                <View style={s.hashBox}>
                  <Text style={s.hashLabel}>HASH SHA-256</Text>
                  <Text style={s.hashValor}>{item.hash}</Text>
                  {item.gps && <Text style={s.hashGps}>📍 {item.gps.latitude.toFixed(6)}, {item.gps.longitude.toFixed(6)}</Text>}
                  {item.timestamp && <Text style={s.hashTs}>⏱ {new Date(item.timestamp).toLocaleString('pt-BR')}</Text>}
                  {item.tipo === 'texto' && (<TouchableOpacity onPress={() => verificarIntegridade(item)} style={s.btnVerificar}><Text style={s.btnVerificarTxt}>Verificar integridade</Text></TouchableOpacity>)}
                </View>
              )}
              <TouchableOpacity onPress={() => setModalEvidencia(item)} style={{ marginTop: 10 }}>
                <LinearGradient colors={[ROXO_MED, ROXO]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
                  <Text style={s.btnGradTxt}>📤 Salvar evidencia</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
        <Modal visible={!!fotoFull} transparent animationType="fade">
          <View style={s.modal}><TouchableOpacity onPress={() => setFotoFull(null)} style={{ flex: 1, justifyContent: 'center' }}><Image source={{ uri: fotoFull }} style={s.fullImg} resizeMode="contain" /><Text style={{ color: 'white', textAlign: 'center', marginTop: 12, opacity: 0.7 }}>Toque para fechar</Text></TouchableOpacity></View>
        </Modal>
        <ModalEvidencia />
      </SafeAreaView>
    );
  }

  if (tela === 'leis') {
    const leis = [
      { titulo: 'Lei Maria da Penha (11.340/2006)', icon: '🛡️', resumo: 'A lei mais importante de protecao a mulher no Brasil.', detalhes: ['Protege contra violencia domestica e familiar de qualquer tipo.', 'Garante Medida Protetiva de Urgencia: agressor afastado em ate 48h.', 'Voce pode pedir a medida protetiva na delegacia, SEM advogado.', 'O agressor pode ser preso em flagrante sem voce assinar representacao.', 'Inclui violencia fisica, psicologica, sexual, patrimonial e moral.', 'Garante atendimento no SUS e assistencia juridica gratuita.'] },
      { titulo: 'Lei do Feminicidio (13.104/2015)', icon: '⚖️', resumo: 'Torna o assassinato de mulheres por razoes de genero crime hediondo.', detalhes: ['Pena de 12 a 30 anos de reclusao.', 'A pena aumenta se cometido na presenca dos filhos ou durante gravidez.', 'Crime hediondo: sem direito a anistia, graca ou fianca.'] },
      { titulo: 'Lei Carolina Dieckmann (12.737/2012)', icon: '📱', resumo: 'Pune invasao de dispositivos e vazamento de fotos intimas.', detalhes: ['Criminaliza acesso nao autorizado ao celular, computador ou e-mail.', 'Pune quem divulga fotos ou videos intimos sem consentimento.', 'Pena de 1 a 3 anos de reclusao, mais multa.'] },
      { titulo: 'Lei da Importunacao Sexual (13.718/2018)', icon: '🚫', resumo: 'Criminaliza atos sexuais sem consentimento.', detalhes: ['Pune toques, beijos ou qualquer ato libinoso sem consentimento.', 'Inclui transportes publicos, eventos e locais de trabalho.', 'Pena de 1 a 5 anos de reclusao.'] },
      { titulo: 'Lei do Minuto Seguinte (12.845/2013)', icon: '🏥', resumo: 'Atendimento medico gratuito para vitimas de violencia sexual.', detalhes: ['Todo hospital publico e obrigado a atender vitimas de violencia sexual.', 'Inclui anticoncepcao de emergencia, profilaxia para HIV e DSTs.', 'NAO precisa de B.O. para ser atendida.'] },
      { titulo: 'Lei do Stalking (14.132/2021)', icon: '👁️', resumo: 'Criminaliza perseguicao obsessiva e monitoramento sem consentimento.', detalhes: ['Pune quem persegue, monitora ou vigia outra pessoa repetidamente.', 'Inclui perseguicao presencial, apps, redes sociais ou telefone.', 'Pena de 1 a 2 anos de reclusao, mais multa.'] },
      { titulo: 'Lei da Revenge Porn (13.718/2018)', icon: '🔒', resumo: 'Pune divulgacao de fotos e videos intimos sem consentimento.', detalhes: ['Compartilhar imagens intimas sem autorizacao e crime.', 'Pena de 1 a 5 anos de reclusao.', 'Plataformas obrigadas a remover o conteudo em 24-48h.'] },
      { titulo: 'Lei Berenice Pohl (13.505/2017)', icon: '👮‍♀️', resumo: 'Garante atendimento especializado para vitimas de violencia sexual.', detalhes: ['A vitima tem direito a ser ouvida por delegada ou agente feminina.', 'Depoimento em sala reservada e sigilosa.', 'Proibe contato da vitima com o agressor na delegacia.'] },
      { titulo: 'Direitos Trabalhistas', icon: '💼', resumo: 'Protecao do emprego para mulheres vitimas de violencia domestica.', detalhes: ['Manutencao do vinculo empregaticio por ate 6 meses.', 'A mulher pode faltar para audiencias sem perder o emprego.', 'O empregador nao pode demitir por motivo relacionado a violencia.'] },
      { titulo: 'Tornozeleira Eletronica (Lei 15.125/2025)', icon: '📡', resumo: 'Agressor deve usar tornozeleira eletronica em casos de risco.', detalhes: ['O juiz pode determinar tornozeleira imediata para o agressor.', 'Em cidades sem juiz, o delegado pode ordenar a instalacao.', 'A vitima recebe um dispositivo que alerta se o agressor se aproximar.', 'Se o agressor violar a distancia, a policia e acionada automaticamente.', 'Descumprir a medida aumenta a pena em ate 50%.', 'Voce pode pedir essa medida na delegacia ou pelo advogado.'] },
    ];
    return (
      <SafeAreaView style={s.base}>
        <StatusBar barStyle="light-content" backgroundColor={ROXO_ESC} />
        {renderHeader('Seus Direitos', 'Conheca as leis que te protegem')}
        <TouchableOpacity onPress={() => Linking.openURL('tel:180')} style={{ marginHorizontal: 16, marginTop: 16 }}>
          <LinearGradient colors={[ROXO_MED, ROXO]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ligue180}>
            <Text style={s.ligue180Num}>180</Text>
            <View><Text style={s.ligue180Label}>Central da Mulher</Text><Text style={s.ligue180Sub}>Gratuito • 24h • Toque para ligar</Text></View>
            <Text style={{ marginLeft: 'auto', fontSize: 24 }}>📞</Text>
          </LinearGradient>
        </TouchableOpacity>
        <ScrollView style={s.conteudo}>
          {leis.map((lei, i) => <LeiCard key={i} lei={lei} />)}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (tela === 'contatos') {
    return (
      <SafeAreaView style={s.base}>
        <StatusBar barStyle="light-content" backgroundColor={ROXO_ESC} />
        {renderHeader('Contatos', 'Pessoas que vao te proteger (' + listaContatos.length + '/5)')}
        <ScrollView style={s.conteudo}>
          <View style={s.formCard}>
            <Text style={s.formTitulo}>+ Adicionar contato</Text>
            <TextInput style={s.input} placeholder="Nome do contato" placeholderTextColor="#C0A0A8" value={tempNome} onChangeText={setTempNome} />
            <TextInput style={s.input} placeholder="Telefone com DDD (ex: 31999991234)" placeholderTextColor="#C0A0A8" value={tempTel} onChangeText={setTempTel} keyboardType="phone-pad" />
            <TouchableOpacity onPress={salvarNovoContato}>
              <LinearGradient colors={[ROXO_MED, ROXO]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
                <Text style={s.btnGradTxt}>Salvar contato</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          {listaContatos.length === 0 ? (
            <View style={s.emptyBox}><Text style={s.emptyIco}>👤</Text><Text style={s.emptyTxt}>Nenhum contato ainda.</Text><Text style={s.emptySubTxt}>Adicione alguem de confianca acima.</Text></View>
          ) : listaContatos.map(c => (
            <View key={c.id} style={s.contatoCard}>
              <LinearGradient colors={[ROXO_MED, ROXO]} style={s.contatoAvatar}>
                <Text style={s.contatoAvatarTxt}>{c.nome.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}><Text style={s.contatoNome}>{c.nome}</Text><Text style={s.contatoTel}>📱 {c.tel}</Text></View>
              <TouchableOpacity onPress={() => excluirContato(c.id)} style={s.lixeiraBtn}><Text style={s.lixeiraIco}>🗑️</Text></TouchableOpacity>
            </View>
          ))}
          <View style={s.dicaBox}><Text style={s.dicaTxt}>💡 No SOS, todos recebem WhatsApp com localizacao, em cascata, com 1 toque.</Text></View>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.base}>
      <StatusBar barStyle="light-content" backgroundColor={ROXO_ESC} />
      <LinearGradient colors={GRAD} locations={GRAD_L} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        <TouchableOpacity onPress={() => setDesbloqueado(false)} style={s.btnVoltarCalc}>
          <Text style={s.btnVoltarCalcTxt}>← Calculadora</Text>
        </TouchableOpacity>
        <View style={s.logoRow}>
          <LogoBasta size={52} />
          <Text style={s.headerNome}>Basta.</Text>
        </View>
        <Text style={s.headerSlogan}>Voce nunca esta sozinha.</Text>
        <View style={s.statusBar}>
          <View style={[s.statusDot, localizacaoAtiva && { backgroundColor: '#60A5FA' }]} />
          <Text style={s.statusTxt}>
            {localizacaoAtiva ? 'Rastreando' : 'Voce nao esta sozinha'} • {listaContatos.length} contato{listaContatos.length !== 1 ? 's' : ''}
            {fraseCodigoAtiva ? ' • Escutando' : ''}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {sosAtivado && (
          <View style={s.sosConfirmacao}>
            <Text style={{ fontSize: 20 }}>🆘</Text>
            <Text style={s.sosConfirmacaoTxt}>{sosMensagem}</Text>
          </View>
        )}

        <View style={s.sosArea}>
          <Animated.View style={[s.anel, { transform: [{ scale: pulso3 }], opacity: 0.06 }]} />
          <Animated.View style={[s.anel, { transform: [{ scale: pulso2 }], opacity: 0.10 }]} />
          <Animated.View style={[s.anel, { transform: [{ scale: pulso1 }], opacity: 0.15 }]} />
          <TouchableOpacity style={s.sosBtn} onPress={enviarSOS} activeOpacity={0.85}>
            <Text style={s.sosT}>SOS</Text>
            <Text style={s.sosEmerg}>EMERGENCIA</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.sosInstrucao}>1 toque → envia direto para todos os contatos</Text>
        <View style={s.botoesRapidos}>
          <TouchableOpacity style={[s.btnRapido, gravandoRapido && s.btnRapidoAtivo]} onPress={iniciarGravacaoRapida}>
            <Text style={s.btnRapidoIco}>{gravandoRapido ? '⏹' : '🎙'}</Text>
            <Text style={[s.btnRapidoTxt, gravandoRapido && { color: ROSE }]}>{gravandoRapido ? 'Parar' : 'Gravar audio'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnRapido, fraseCodigoAtiva && s.btnRapidoVozAtivo]} onPress={toggleFraseCodigo}>
            <Text style={s.btnRapidoIco}>{fraseCodigoAtiva ? '👂' : '🗣'}</Text>
            <Text style={[s.btnRapidoTxt, fraseCodigoAtiva && { color: ROXO }]}>{fraseCodigoAtiva ? 'Escutando...' : 'Frase-codigo'}</Text>
          </TouchableOpacity>
        </View>
        {fraseCodigoAtiva && (
          <View style={s.vozStatusBox}>
            <Text style={s.vozStatusTxt}>{vozStatus || 'Escutando...'}</Text>
            <Text style={s.vozFrases}>SOS automatico ao detectar frase — sem confirmacao</Text>
          </View>
        )}
        <View style={s.grid}>
          <TouchableOpacity style={s.card} onPress={() => setTela('diario')}><Text style={s.cardIco}>📓</Text><Text style={s.cardTitulo}>Diario</Text><Text style={s.cardSub}>Registrar incidentes</Text></TouchableOpacity>
          <TouchableOpacity style={s.card} onPress={() => setTela('leis')}><Text style={s.cardIco}>⚖️</Text><Text style={s.cardTitulo}>Seus Direitos</Text><Text style={s.cardSub}>Leis que te protegem</Text></TouchableOpacity>
          <TouchableOpacity style={s.card} onPress={() => Linking.openURL('tel:180')}><Text style={s.cardIco}>📞</Text><Text style={s.cardTitulo}>Ligue 180</Text><Text style={s.cardSub}>Central gratuita 24h</Text></TouchableOpacity>
          <TouchableOpacity style={s.card} onPress={() => setTela('contatos')}><Text style={s.cardIco}>👥</Text><Text style={s.cardTitulo}>Contatos</Text><Text style={s.cardSub}>{listaContatos.length === 0 ? 'Adicionar' : listaContatos.length + ' cadastrado' + (listaContatos.length !== 1 ? 's' : '')}</Text></TouchableOpacity>
        </View>
        {listaContatos.length === 0 && (
          <TouchableOpacity style={s.alertaCard} onPress={() => setTela('contatos')}>
            <Text style={{ fontSize: 22 }}>⚠️</Text>
            <View style={{ flex: 1 }}><Text style={s.alertaTitulo}>Adicione contatos de emergencia</Text><Text style={s.alertaSub}>O SOS precisa de contatos cadastrados</Text></View>
            <Text style={{ fontSize: 20, color: '#8A6070' }}>›</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.rowCard} onPress={() => setTela('mapa')}>
          <Text style={{ fontSize: 18 }}>📍</Text>
          <View style={{ flex: 1 }}><Text style={s.rowCardTitulo}>Mapa de delegacias</Text><Text style={s.rowCardSub}>Encontre a unidade mais proxima</Text></View>
          <Text style={{ fontSize: 18, color: '#8A6070' }}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.rowCard, localizacaoAtiva && s.rowCardAtivo]} onPress={toggleLocalizacao}>
          <Text style={{ fontSize: 18 }}>🗺️</Text>
          <View style={{ flex: 1 }}><Text style={s.rowCardTitulo}>Localizacao continua</Text><Text style={s.rowCardSub}>{localizacaoAtiva ? 'Ativa — rastreando em segundo plano' : 'Toque para ativar rastreamento'}</Text></View>
          <View style={[s.rowDot, localizacaoAtiva && { backgroundColor: '#60A5FA' }]} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.rowCard, fraseCodigoAtiva && s.rowCardVoz]} onPress={toggleFraseCodigo}>
          <Text style={{ fontSize: 18 }}>🗣</Text>
          <View style={{ flex: 1 }}><Text style={s.rowCardTitulo}>Frase-codigo</Text><Text style={s.rowCardSub}>{fraseCodigoAtiva ? 'Ativa — SOS automatico ao detectar' : 'Toque para ativar escuta'}</Text></View>
          <View style={[s.rowDot, fraseCodigoAtiva && { backgroundColor: ROXO }]} />
        </TouchableOpacity>
        <TouchableOpacity style={s.rowCard} onPress={() => setShowGerenciarFrases(!showGerenciarFrases)}>
          <Text style={{ fontSize: 18 }}>✏️</Text>
          <View style={{ flex: 1 }}><Text style={s.rowCardTitulo}>Minhas frases-codigo</Text><Text style={s.rowCardSub}>Personalizar frases que ativam o SOS</Text></View>
          <Text style={{ fontSize: 14, color: '#8A6070' }}>{showGerenciarFrases ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showGerenciarFrases && (
          <View style={s.frasesCard}>
            <Text style={s.frasesTitulo}>Frases que ativam o SOS automaticamente:</Text>
            {frases.map((f, i) => (
              <View key={i} style={s.fraseItem}>
                {editandoFrase === i ? (
                  <View style={{ flex: 1 }}>
                    <TextInput style={s.fraseInput} value={textoEdicao} onChangeText={setTextoEdicao} autoFocus placeholder="Digite a frase..." placeholderTextColor="#bbb" />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <TouchableOpacity style={s.fraseSalvarBtn} onPress={salvarEdicaoFrase}><Text style={s.fraseSalvarTxt}>✓ Salvar</Text></TouchableOpacity>
                      <TouchableOpacity style={s.fraseCancelarBtn} onPress={() => { setEditandoFrase(null); setTextoEdicao(''); }}><Text style={s.fraseCancelarTxt}>Cancelar</Text></TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={s.fraseTxt}>"{f}"</Text>
                    <TouchableOpacity onPress={() => { setEditandoFrase(i); setTextoEdicao(f); }} style={s.fraseEditBtn}><Text style={s.fraseEditIco}>✏️</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => excluirFrase(i)} style={s.fraseDelBtn}><Text style={s.fraseDelIco}>🗑️</Text></TouchableOpacity>
                  </>
                )}
              </View>
            ))}
            <View style={s.fraseAdicionarRow}>
              <TextInput style={s.fraseNovaInput} value={novaFrase} onChangeText={setNovaFrase} placeholder="+ Adicionar minha frase personalizada..." placeholderTextColor="#bbb" />
              <TouchableOpacity onPress={adicionarFrase}>
                <LinearGradient colors={[ROXO_MED, ROXO]} style={s.fraseAddBtn}>
                  <Text style={s.fraseAddTxt}>+</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <View style={s.fraseAviso}><Text style={s.fraseAvisoTxt}>⚠️ Ao detectar qualquer frase, o SOS e enviado imediatamente, sem confirmacao.</Text></View>
          </View>
        )}
        <LinearGradient colors={GRAD} locations={GRAD_L} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}>
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <LogoBasta size={64} />
          </View>
          <Text style={s.bannerTxt}>Protecao completa no seu bolso</Text>
          <Text style={s.bannerSub}>Mais que um app. Um suporte real.</Text>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

function LeiCard({ lei }) {
  const [aberta, setAberta] = useState(false);
  return (
    <TouchableOpacity style={s.leiCard} onPress={() => setAberta(!aberta)} activeOpacity={0.8}>
      <View style={s.leiTopo}>
        <Text style={s.leiIco}>{lei.icon}</Text>
        <View style={{ flex: 1 }}><Text style={s.leiTitulo}>{lei.titulo}</Text><Text style={s.leiResumo}>{lei.resumo}</Text></View>
        <Text style={s.leiSeta}>{aberta ? '▲' : '▼'}</Text>
      </View>
      {aberta && (
        <View style={s.leiDetalhes}>
          {lei.detalhes.map((d, i) => (<View key={i} style={s.leiItem}><Text style={s.leiDot}>•</Text><Text style={s.leiTxt}>{d}</Text></View>))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  base: { flex: 1, backgroundColor: FUNDO },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  headerNome: { fontStyle: 'italic', fontSize: 44, fontWeight: '800', color: 'white', letterSpacing: -0.5 },
  headerSlogan: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: 16 },
  statusBar: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, backgroundColor: '#4ADE80', borderRadius: 5 },
  statusTxt: { color: 'white', fontSize: 12, fontWeight: '500', flex: 1 },
  telaHeader: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 24 },
  telaLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  voltarBtn: { marginBottom: 10 },
  voltarTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  telaTitulo: { fontStyle: 'italic', fontSize: 30, fontWeight: 'bold', color: 'white' },
  telaSlogan: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  conteudo: { flex: 1, padding: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#1A0E14', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#888', marginBottom: 20 },
  modalOpcao: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  modalOpcaoIco: { fontSize: 26, width: 32, textAlign: 'center' },
  modalOpcaoInfo: { flex: 1 },
  modalOpcaoTxt: { fontSize: 15, fontWeight: '600', color: '#1A0E14' },
  modalOpcaoSub: { fontSize: 12, color: '#888', marginTop: 2 },
  modalVoltar: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  modalVoltarTxt: { fontSize: 14, color: '#555', fontWeight: '600' },
  sosConfirmacao: { backgroundColor: '#1A0A0A', marginHorizontal: 16, marginTop: 10, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: ROSE },
  sosConfirmacaoTxt: { flex: 1, color: 'white', fontSize: 12, fontWeight: '600' },
  sosArea: { alignItems: 'center', justifyContent: 'center', height: 160, marginVertical: 8 },
  anel: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: ROSE },
  sosBtn: { width: 105, height: 105, borderRadius: 53, backgroundColor: ROSE, alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: ROSE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16 },
  sosT: { color: 'white', fontSize: 30, fontWeight: 'bold' },
  sosEmerg: { color: 'white', fontSize: 9, fontWeight: '600', letterSpacing: 2, marginTop: 2 },
  sosInstrucao: { textAlign: 'center', color: '#8A6070', fontSize: 12, marginBottom: 14 },
  botoesRapidos: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 14 },
  btnRapido: { flex: 1, backgroundColor: 'white', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(107,63,160,0.15)', elevation: 2 },
  btnRapidoAtivo: { backgroundColor: '#FFF0F0', borderColor: ROSE },
  btnRapidoVozAtivo: { backgroundColor: '#EDE5F8', borderColor: ROXO },
  btnRapidoIco: { fontSize: 22, marginBottom: 4 },
  btnRapidoTxt: { fontSize: 11, fontWeight: '600', color: '#1A0E14', textAlign: 'center' },
  vozStatusBox: { backgroundColor: '#EDE5F8', borderRadius: 12, marginHorizontal: 16, padding: 12, marginBottom: 12 },
  vozStatusTxt: { fontSize: 12, fontWeight: '700', color: ROXO, marginBottom: 4 },
  vozFrases: { fontSize: 11, color: '#4A2D7A', lineHeight: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  card: { width: '47%', backgroundColor: 'white', borderRadius: 18, padding: 18, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, borderWidth: 1, borderColor: 'rgba(107,63,160,0.1)' },
  cardIco: { fontSize: 30, marginBottom: 10 },
  cardTitulo: { fontSize: 14, fontWeight: '700', color: '#1A0E14', marginBottom: 3 },
  cardSub: { fontSize: 12, color: '#8A6070' },
  alertaCard: { backgroundColor: '#FDF4DC', borderRadius: 16, margin: 16, marginTop: 0, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E8A838' },
  alertaTitulo: { fontSize: 14, fontWeight: '600', color: '#1A0E14' },
  alertaSub: { fontSize: 12, color: '#8A6070', marginTop: 2 },
  rowCard: { backgroundColor: 'white', borderRadius: 14, marginHorizontal: 16, marginBottom: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: 'rgba(107,63,160,0.12)', elevation: 1 },
  rowCardAtivo: { backgroundColor: '#EFF8FF', borderColor: '#60A5FA' },
  rowCardVoz: { backgroundColor: '#EDE5F8', borderColor: ROXO },
  rowCardTitulo: { fontSize: 13, fontWeight: '600', color: '#1A0E14' },
  rowCardSub: { fontSize: 11, color: '#8A6070', marginTop: 2 },
  rowDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ddd' },
  frasesCard: { backgroundColor: 'white', borderRadius: 14, marginHorizontal: 16, marginBottom: 8, padding: 16, borderWidth: 1.5, borderColor: 'rgba(107,63,160,0.15)' },
  frasesTitulo: { fontSize: 12, fontWeight: '700', color: ROXO, marginBottom: 12 },
  fraseItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#EDE5F8', gap: 8 },
  fraseTxt: { flex: 1, fontSize: 13, color: '#1A0E14', fontStyle: 'italic' },
  fraseEditBtn: { padding: 6 }, fraseEditIco: { fontSize: 14 },
  fraseDelBtn: { padding: 6 }, fraseDelIco: { fontSize: 14 },
  fraseInput: { backgroundColor: '#F9F3F6', borderRadius: 8, padding: 10, fontSize: 13, color: '#1A0E14', borderWidth: 1, borderColor: '#D4B8F0' },
  fraseSalvarBtn: { flex: 1, backgroundColor: ROXO, borderRadius: 8, padding: 8, alignItems: 'center' },
  fraseSalvarTxt: { color: 'white', fontSize: 12, fontWeight: '600' },
  fraseCancelarBtn: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 8, padding: 8, alignItems: 'center' },
  fraseCancelarTxt: { color: '#666', fontSize: 12 },
  fraseAdicionarRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  fraseNovaInput: { flex: 1, backgroundColor: '#F9F3F6', borderRadius: 10, padding: 12, fontSize: 13, color: '#1A0E14', borderWidth: 1, borderColor: '#D4B8F0' },
  fraseAddBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fraseAddTxt: { color: 'white', fontSize: 24, fontWeight: '300' },
  fraseAviso: { backgroundColor: '#FFF0F0', borderRadius: 10, padding: 10, marginTop: 12, borderWidth: 1, borderColor: 'rgba(200,51,90,0.2)' },
  fraseAvisoTxt: { fontSize: 11, color: '#9E1F42', lineHeight: 16 },
  btnVoltarCalc: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, marginBottom: 6 },
  btnVoltarCalcTxt: { color: 'rgba(255,255,255,0.90)', fontSize: 12, fontWeight: '600' },
  banner: { margin: 16, borderRadius: 18, padding: 22, marginBottom: 32, alignItems: 'center' },
  bannerTxt: { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  bannerSub: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },
  botoesMedia: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  btnMedia: { flex: 1, backgroundColor: 'white', borderRadius: 14, padding: 16, alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: 'rgba(107,63,160,0.1)' },
  btnMediaIco: { fontSize: 28, marginBottom: 6 },
  btnMediaTxt: { fontSize: 14, fontWeight: '600', color: '#1A0E14' },
  inputRelato: { backgroundColor: 'white', borderRadius: 14, padding: 16, fontSize: 15, color: '#1A0E14', marginBottom: 12, borderWidth: 1.5, borderColor: '#D4B8F0', minHeight: 120 },
  blindagemCard: { backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: 'rgba(107,63,160,0.15)' },
  blindagemTitulo: { fontSize: 13, fontWeight: '700', color: ROXO, marginBottom: 12 },
  toggleLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#EDE5F8' },
  toggleInfo: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: '#1A0E14' },
  toggleSub: { fontSize: 11, color: '#8A6070', marginTop: 1 },
  tagAtivo: { backgroundColor: '#F0FFF4', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  tagAtivoTxt: { fontSize: 10, fontWeight: '700', color: VERDE },
  salvandoBox: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#D4B8F0', alignItems: 'center', gap: 8 },
  salvandoTxt: { fontSize: 13, color: ROXO, fontWeight: '600' },
  progressBar: { width: '100%', height: 4, backgroundColor: '#EDE5F8', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: ROXO, borderRadius: 2 },
  btnGrad: { borderRadius: 100, padding: 16, alignItems: 'center' },
  btnGradTxt: { color: 'white', fontSize: 15, fontWeight: '600' },
  dicaBackup: { backgroundColor: '#EDE5F8', borderRadius: 12, padding: 12, marginBottom: 16 },
  dicaBackupTxt: { fontSize: 12, color: '#4A2D7A', lineHeight: 18 },
  itemCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: ROXO, elevation: 2 },
  itemTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemData: { fontSize: 12, color: '#8A6070' },
  lixeiraBtn: { width: 36, height: 36, backgroundColor: '#EDE5F8', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  lixeiraIco: { fontSize: 16 },
  badgesRow: { flexDirection: 'row', gap: 5, marginBottom: 8, flexWrap: 'wrap' },
  badgeHash: { backgroundColor: '#EEF1FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeHashTxt: { fontSize: 10, fontWeight: '700', color: '#3A5BA5' },
  badgeGPS: { backgroundColor: '#EDFFF4', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGPSTxt: { fontSize: 10, fontWeight: '700', color: '#1A6B3A' },
  badgeTime: { backgroundColor: '#FFF8EE', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTimeTxt: { fontSize: 10, fontWeight: '700', color: '#8A5A00' },
  itemTexto: { fontSize: 14, color: '#1A0E14', lineHeight: 20 },
  itemFoto: { width: '100%', height: 200, borderRadius: 12, marginTop: 8 },
  itemDica: { fontSize: 11, color: '#8A6070', textAlign: 'center', marginTop: 4 },
  audioBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9F3F6', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: 'rgba(107,63,160,0.2)' },
  audioIco: { fontSize: 24 },
  audioTxt: { fontSize: 13, color: ROXO, fontWeight: '600' },
  videoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9F3F6', borderRadius: 12, padding: 14 },
  videoIco: { fontSize: 24 },
  videoTxt: { fontSize: 13, color: '#8A6070' },
  hashToggle: { marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#EDE5F8' },
  hashToggleTxt: { fontSize: 12, color: ROXO, fontWeight: '600' },
  hashBox: { backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, marginTop: 8 },
  hashLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', letterSpacing: 0.8, marginBottom: 4 },
  hashValor: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 11, color: '#555', lineHeight: 16, marginBottom: 6 },
  hashGps: { fontSize: 11, color: '#1A6B3A', marginBottom: 3 },
  hashTs: { fontSize: 11, color: '#8A5A00', marginBottom: 8 },
  btnVerificar: { backgroundColor: 'white', borderRadius: 8, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: '#D4B8F0', marginBottom: 8 },
  btnVerificarTxt: { fontSize: 12, color: ROXO, fontWeight: '600' },
  emptyBox: { alignItems: 'center', padding: 32 },
  emptyIco: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { fontSize: 15, fontWeight: '600', color: '#1A0E14', marginBottom: 4 },
  emptySubTxt: { fontSize: 13, color: '#8A6070', textAlign: 'center' },
  formCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 20 },
  formTitulo: { fontSize: 16, fontWeight: '600', color: '#1A0E14', marginBottom: 14 },
  input: { backgroundColor: '#F9F3F6', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A0E14', marginBottom: 12, borderWidth: 1.5, borderColor: '#D4B8F0' },
  contatoCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, elevation: 2 },
  contatoAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  contatoAvatarTxt: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  contatoNome: { fontSize: 15, fontWeight: '600', color: '#1A0E14' },
  contatoTel: { fontSize: 13, color: '#8A6070', marginTop: 2 },
  dicaBox: { backgroundColor: '#EDE5F8', borderRadius: 14, padding: 16, marginTop: 8 },
  dicaTxt: { fontSize: 13, color: '#4A2D7A', lineHeight: 20 },
  ligue180: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ligue180Num: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  ligue180Label: { color: 'white', fontSize: 13, fontWeight: '600' },
  ligue180Sub: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  leiCard: { backgroundColor: 'white', borderRadius: 16, padding: 18, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: ROXO, elevation: 2 },
  leiTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  leiIco: { fontSize: 28 },
  leiTitulo: { fontSize: 14, fontWeight: '700', color: '#1A0E14', marginBottom: 4, lineHeight: 20 },
  leiResumo: { fontSize: 12, color: '#8A6070', lineHeight: 17 },
  leiSeta: { fontSize: 12, color: '#8A6070', marginLeft: 4 },
  leiDetalhes: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EDE5F8' },
  leiItem: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  leiDot: { color: ROXO, fontWeight: 'bold', fontSize: 16, lineHeight: 20 },
  leiTxt: { flex: 1, fontSize: 13, color: '#4A2D3A', lineHeight: 20 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  fullImg: { width: '100%', height: '80%' },
}); 

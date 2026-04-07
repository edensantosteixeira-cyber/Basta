import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Vibration, SafeAreaView, StatusBar
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const SENHA = '1808';
const GAP = 12;
const BTN = (width - GAP * 5) / 4;

export default function CalculadoraCamuflada({ onDesbloquear }) {
  const [display, setDisplay] = useState('0');
  const [operacao, setOperacao] = useState(null);
  const [valorAnterior, setValorAnterior] = useState(null);
  const [resetar, setResetar] = useState(false);
  const [estaGravando, setEstaGravando] = useState(false);
  const [gravacao, setGravacao] = useState(null);
  const sequencia = useRef('');

  const gerenciarGravacao = async () => {
    try {
      if (estaGravando) {
        setEstaGravando(false);
        await gravacao.stopAndUnloadAsync();
        const uri = gravacao.getURI();
        const dados = await AsyncStorage.getItem('@b_d');
        let lista = dados ? JSON.parse(dados) : [];
        const novoAudio = {
          id: Date.now().toString(),
          tipo: 'audio',
          data: new Date().toLocaleString('pt-BR'),
          timestamp: new Date().toISOString(),
          conteudo: uri
        };
        await AsyncStorage.setItem('@b_d', JSON.stringify([novoAudio, ...lista]));
        setGravacao(null);
        Vibration.vibrate(200);
      } else {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') return;
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
        const { recording: novaGravacao } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setGravacao(novaGravacao);
        setEstaGravando(true);
        Vibration.vibrate(100);
      }
    } catch (err) {
      console.log('Erro gravação:', err);
    }
  };

  const pressionar = (valor) => {
    if (valor === 'AC') {
      setDisplay('0'); setOperacao(null);
      setValorAnterior(null); setResetar(false);
      sequencia.current = '';
      return;
    }
    if (valor === '+/-') { setDisplay(d => String(parseFloat(d) * -1)); return; }
    if (valor === '%') { setDisplay(d => String(parseFloat(d) / 100)); return; }
    if (['+', '-', '×', '÷'].includes(valor)) {
      setValorAnterior(display); setOperacao(valor);
      setResetar(true); sequencia.current = '';
      return;
    }
    if (valor === '=') {
      if (sequencia.current === SENHA) {
        Vibration.vibrate([100, 100, 100]);
        onDesbloquear();
        return;
      }
      if (operacao && valorAnterior) {
        const a = parseFloat(valorAnterior);
        const b = parseFloat(display);
        let resultado = 0;
        if (operacao === '+') resultado = a + b;
        if (operacao === '-') resultado = a - b;
        if (operacao === '×') resultado = a * b;
        if (operacao === '÷') resultado = b !== 0 ? a / b : 0;
        const str = String(parseFloat(resultado.toFixed(8)));
        setDisplay(str.length > 9 ? resultado.toExponential(2) : str);
        setOperacao(null); setValorAnterior(null); setResetar(true);
      }
      sequencia.current = '';
      return;
    }
    if (valor === ',') { if (!display.includes('.')) setDisplay(d => d + '.'); return; }
    sequencia.current = display === '0' || resetar ? valor : sequencia.current + valor;
    if (display === '0' || resetar) { setDisplay(String(valor)); setResetar(false); }
    else { if (display.length >= 9) return; setDisplay(d => d + valor); }
  };

  const Btn = ({ label, tipo, wide, onPress }) => (
    <TouchableOpacity
      style={[
        s.btn,
        tipo === 'cinza' && s.btnCinza,
        tipo === 'laranja' && s.btnLaranja,
        tipo === 'escuro' && s.btnEscuro,
        tipo === 'mic' && (estaGravando ? s.btnMicAtivo : s.btnMic),
        { width: BTN, height: BTN, borderRadius: BTN / 2 },
        wide && { width: BTN * 2 + GAP, alignItems: 'flex-start', paddingLeft: BTN * 0.38 },
      ]}
      onPress={onPress || (() => pressionar(label))}
      activeOpacity={0.75}
    >
      {tipo === 'mic' ? (
        <View style={s.micCorpo}>
          <View style={[s.micCabeca, estaGravando && { backgroundColor: 'white' }]} />
          <View style={[s.micBase, estaGravando && { borderColor: 'white' }]} />
          <View style={[s.micHaste, estaGravando && { backgroundColor: 'white' }]} />
          <View style={[s.micPe, estaGravando && { backgroundColor: 'white' }]} />
        </View>
      ) : (
        <Text style={[s.btnTxt, (tipo === 'cinza' || tipo === 'mic') && s.btnTxtEscuro]}>{label}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={s.displayArea}>
        <Text style={s.displayTxt} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
      </View>
      <View style={s.teclado}>
        <View style={s.linha}>
          <Btn label="AC" tipo="cinza" />
          <Btn label="+/-" tipo="cinza" />
          <Btn label="%" tipo="cinza" />
          <Btn label="MIC" tipo="mic" onPress={gerenciarGravacao} />
        </View>
        <View style={s.linha}>
          <Btn label="7" tipo="escuro" />
          <Btn label="8" tipo="escuro" />
          <Btn label="9" tipo="escuro" />
          <Btn label="÷" tipo="laranja" />
        </View>
        <View style={s.linha}>
          <Btn label="4" tipo="escuro" />
          <Btn label="5" tipo="escuro" />
          <Btn label="6" tipo="escuro" />
          <Btn label="×" tipo="laranja" />
        </View>
        <View style={s.linha}>
          <Btn label="1" tipo="escuro" />
          <Btn label="2" tipo="escuro" />
          <Btn label="3" tipo="escuro" />
          <Btn label="-" tipo="laranja" />
        </View>
        <View style={s.linha}>
          <Btn label="0" tipo="escuro" wide />
          <Btn label="," tipo="escuro" />
          <Btn label="+" tipo="laranja" />
        </View>
        <View style={s.linha}>
          <TouchableOpacity
            style={[s.btn, s.btnLaranja, { width: BTN * 2 + GAP, height: BTN, borderRadius: BTN / 2 }]}
            onPress={() => pressionar('=')} activeOpacity={0.75}
          >
            <Text style={s.btnTxt}>=</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end', paddingBottom: 28 },
  displayArea: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', paddingHorizontal: 24, paddingBottom: 16 },
  displayTxt: { fontSize: 80, fontWeight: '200', color: 'white', letterSpacing: -2 },
  teclado: { paddingHorizontal: GAP, gap: GAP },
  linha: { flexDirection: 'row', gap: GAP, justifyContent: 'center', alignItems: 'center' },
  btn: { alignItems: 'center', justifyContent: 'center' },
  btnCinza: { backgroundColor: '#A5A5A5' },
  btnLaranja: { backgroundColor: '#FF9F0A' },
  btnEscuro: { backgroundColor: '#333335' },
  btnMic: { backgroundColor: '#A5A5A5' },
  btnMicAtivo: { backgroundColor: '#C0392B' },
  btnTxt: { fontSize: 32, fontWeight: '400', color: 'white' },
  btnTxtEscuro: { color: '#1C1C1E' },
  micCorpo: { alignItems: 'center', gap: 1 },
  micCabeca: { width: 10, height: 14, backgroundColor: '#1C1C1E', borderRadius: 5 },
  micBase: { width: 16, height: 8, borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#1C1C1E', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  micHaste: { width: 2, height: 4, backgroundColor: '#1C1C1E' },
  micPe: { width: 12, height: 2, backgroundColor: '#1C1C1E', borderRadius: 1 },
}); 

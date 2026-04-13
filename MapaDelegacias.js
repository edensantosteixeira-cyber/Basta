import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Linking, ActivityIndicator, ScrollView, Image
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';

const ROXO_ESC = '#3A1F6E';
const ROXO     = '#6B3FA0';
const ROXO_MED = '#5A2D8A';
const ROSE     = '#C8335A';
const GRAD     = ['#3A1F6E', '#6B3FA0', '#8B55C0', '#5A2D8A'];
const GRAD_L   = [0, 0.45, 0.75, 1];

const LOGO = require('./assets/basta_logo.png');

const LogoBasta = ({ size = 44 }) => (
  <Image
    source={LOGO}
    style={{ width: size, height: size, borderRadius: size * 0.18 }}
    resizeMode='contain'
  />
);

const EMERGENCIAS = [
  { nome: 'DEAM - Delegacia Especializada', tel: '190', tipo: 'especializada' },
  { nome: 'DDM - Delegacia de Defesa da Mulher', tel: '190', tipo: 'especializada' },
  { nome: 'Delegacia de Polícia Civil', tel: '197', tipo: 'civil' },
  { nome: 'Polícia Militar', tel: '190', tipo: 'pm' },
  { nome: 'Central da Mulher', tel: '180', tipo: 'central' },
  { nome: 'SAMU', tel: '192', tipo: 'saude' },
  { nome: 'Bombeiros', tel: '193', tipo: 'bombeiros' },
];

export default function MapaDelegacias({ onVoltar }) {
  const [carregando, setCarregando] = useState(false);
  const [cidade, setCidade] = useState('');
  const [coords, setCoords] = useState(null);

  useEffect(() => { obterLocalizacao(); }, []);

  const obterLocalizacao = async () => {
    try {
      setCarregando(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        const [endereco] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (endereco) setCidade((endereco.city || endereco.subregion || '') + ', ' + (endereco.region || ''));
      }
    } catch (e) {} finally { setCarregando(false); }
  };

  const abrirMapaDEAM = () => {
    if (coords) Linking.openURL('https://www.google.com/maps/search/delegacia+da+mulher/@' + coords.lat + ',' + coords.lng + ',14z');
    else Linking.openURL('https://www.google.com/maps/search/' + encodeURIComponent('delegacia da mulher ' + cidade));
  };

  const abrirMapaDelegacias = () => {
    if (coords) Linking.openURL('https://www.google.com/maps/search/delegacia+de+policia/@' + coords.lat + ',' + coords.lng + ',14z');
    else Linking.openURL('https://www.google.com/maps/search/' + encodeURIComponent('delegacia de policia ' + cidade));
  };

  const abrirRotaUPA = () => {
    if (coords) Linking.openURL('https://www.google.com/maps/search/UPA+hospital/@' + coords.lat + ',' + coords.lng + ',14z');
    else Linking.openURL('https://www.google.com/maps/search/UPA');
  };

  const ligar = (tel) => Linking.openURL('tel:' + tel);

  const icone = (tipo) => {
    switch (tipo) {
      case 'especializada': return '🏛️';
      case 'civil': return '👮';
      case 'pm': return '🚔';
      case 'central': return '📞';
      case 'saude': return '🚑';
      case 'bombeiros': return '🚒';
      default: return '📍';
    }
  };

  return (
    <SafeAreaView style={s.base}>
      <StatusBar barStyle='light-content' backgroundColor={ROXO_ESC} />
      <LinearGradient colors={GRAD} locations={GRAD_L} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Text style={s.voltarTxt}>← Voltar</Text>
        </TouchableOpacity>
        <View style={s.logoRow}>
          <LogoBasta size={32} />
          <Text style={s.titulo}>Delegacias</Text>
        </View>
        <Text style={s.subtitulo}>Encontre ajuda perto de você</Text>
        {cidade ? <Text style={s.cidade}>📌 {cidade}</Text> : null}
      </LinearGradient>
      <ScrollView style={s.conteudo}>
        <Text style={s.sectionTitle}>🗺️ Abrir mapa próximo a você</Text>
        <TouchableOpacity onPress={abrirMapaDEAM} style={{ marginBottom: 10 }}>
          <LinearGradient colors={['#C8335A', '#A0204A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnMapa}>
            {carregando ? <ActivityIndicator color='white' size='small' /> : <Text style={s.btnMapaTxt}>🏛️  Delegacias da Mulher (DEAM)</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={abrirMapaDelegacias} style={{ marginBottom: 10 }}>
          <LinearGradient colors={[ROXO, '#8B55C0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnMapa}>
            <Text style={s.btnMapaTxt}>👮  Delegacias de Polícia</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={abrirRotaUPA} style={{ marginBottom: 20 }}>
          <LinearGradient colors={['#1E7A5A', '#2AAA7A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnMapa}>
            <Text style={s.btnMapaTxt}>🏥  UPA / Hospital próximo</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={s.sectionTitle}>📞 Números de emergência</Text>
        {EMERGENCIAS.map((d, i) => (
          <TouchableOpacity key={i} style={s.card} onPress={() => ligar(d.tel)}>
            <Text style={s.cardIco}>{icone(d.tipo)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.cardNome}>{d.nome}</Text>
              <Text style={s.cardTel}>📞 {d.tel} — Toque para ligar</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={s.dicaCard}>
          <Text style={s.dicaTitulo}>💡 Dica importante</Text>
          <Text style={s.dicaTxt}>A DEAM é o local mais indicado para registrar B.O. em casos de violência doméstica. Você NÃO precisa de advogado. O atendimento deve ser feito por agente feminina em sala reservada.</Text>
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  base: { flex: 1, backgroundColor: '#F9F3F6' },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 24 },
  voltarBtn: { marginBottom: 10 },
  voltarTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  titulo: { fontSize: 30, fontWeight: 'bold', fontStyle: 'italic', color: 'white' },
  subtitulo: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  cidade: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 8, fontWeight: '600' },
  conteudo: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B3FA0', marginBottom: 12, letterSpacing: 0.5 },
  btnMapa: { borderRadius: 14, padding: 16, alignItems: 'center' },
  btnMapaTxt: { color: 'white', fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: 'white', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#6B3FA0' },
  cardIco: { fontSize: 26 },
  cardNome: { fontSize: 13, fontWeight: '600', color: '#1A0E14', marginBottom: 3 },
  cardTel: { fontSize: 12, color: '#C8335A', fontWeight: '500' },
  dicaCard: { backgroundColor: '#EDE5F8', borderRadius: 14, padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(107,63,160,0.2)' },
  dicaTitulo: { fontSize: 14, fontWeight: '700', color: '#6B3FA0', marginBottom: 10 },
  dicaTxt: { fontSize: 13, color: '#4A2D7A', lineHeight: 20 },
});
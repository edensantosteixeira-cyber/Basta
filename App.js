const acionarSOSCompleto = async () => {
    // Vibração forte ao acionar SOS
    Vibration.vibrate([0, 500, 200, 500, 200, 800]);
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (e) {}
    setSosAtivado(true); setSosMensagem('🆘 Acionando ajuda...');
    if (!localizacaoAtiva) await iniciarLocalizacaoContinua();
    const gps = await obterLocalizacaoAtual();
    const linkMaps = gps
      ? `https://maps.google.com/?q=${gps.latitude},${gps.longitude}`
      : 'Localizacao nao disponivel';

    const msgTexto = `SOS EMERGENCIA - Preciso de ajuda AGORA! Localizacao: ${linkMaps} - App Basta`;

    let enviados = 0;
    for (let i = 0; i < listaContatos.length; i++) {
      const c = listaContatos[i];
      setSosMensagem(`📤 Enviando para ${c.nome}... (${i + 1}/${listaContatos.length})`);

      const tel = c.tel.replace(/\D/g, '');
      const telFull = tel.startsWith('55') ? tel : `55${tel}`;

      // 1) SMS primeiro
      try {
        const smsDisponivel = await SMS.isAvailableAsync();
        if (smsDisponivel) {
          await SMS.sendSMSAsync([c.tel], msgTexto);
        }
      } catch (e) {}

      // Vibração ao enviar SMS
      Vibration.vibrate(150);
      await new Promise(r => setTimeout(r, 800));

      // 2) WhatsApp depois
      try {
        const url = `whatsapp://send?phone=%2B${telFull}&text=${encodeURIComponent(msgTexto)}`;
        await Linking.openURL(url);
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {}

      // Vibração ao enviar WhatsApp
      Vibration.vibrate([0, 150, 100, 150]);
      enviados++;
    }

    setSosMensagem(`✅ ${enviados} contato${enviados !== 1 ? 's' : ''} alertado${enviados !== 1 ? 's' : ''}!`);
    Vibration.vibrate([0, 300, 100, 300, 100, 500]);
    setTimeout(() => { setSosAtivado(false); setSosMensagem(''); }, 4000);
  }; 

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { supabase } from '../services/supabase';

export function PasswordRecoveryModal() {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === 'PASSWORD_RECOVERY') setVisible(true);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const save = async () => {
    if (busy) return;
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setMessage('Hasło musi mieć co najmniej 8 znaków, literę i cyfrę.');
      return;
    }
    if (password !== confirmation) { setMessage('Hasła nie są identyczne.'); return; }
    setBusy(true);
    try {
      if (!supabase) throw new Error('Brak połączenia z usługą kont.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmation('');
      setMessage('Hasło zostało zmienione. Możesz zamknąć to okno.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się zmienić hasła.');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) setVisible(false); }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Ustaw nowe hasło</Text>
          <TextInput style={styles.input} accessibilityLabel="Nowe hasło" placeholder="Nowe hasło" secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} editable={!busy} />
          <TextInput style={styles.input} accessibilityLabel="Powtórz nowe hasło" placeholder="Powtórz nowe hasło" secureTextEntry autoCapitalize="none" value={confirmation} onChangeText={setConfirmation} editable={!busy} />
          {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
          <Button title={busy ? 'Zapisywanie…' : 'Zapisz hasło'} onPress={() => void save()} disabled={busy} color="#059669" />
          <Button title="Zamknij" onPress={() => setVisible(false)} disabled={busy} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0008', padding: 24 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 14, minHeight: 48 },
});

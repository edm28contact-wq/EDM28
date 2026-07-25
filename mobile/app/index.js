import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/supabase';

const C = {
  ink: '#0B1220',
  navy: '#14213D',
  blue: '#2563EB',
  cyan: '#06B6D4',
  green: '#16A34A',
  orange: '#F59E0B',
  red: '#DC2626',
  violet: '#7C3AED',
  bg: '#F3F6FB',
  card: '#FFFFFF',
  muted: '#64748B',
  border: '#E2E8F0',
};

const euro = (value) => Number(value || 0).toLocaleString('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
const num = (value) => Number(value || 0);
const monthKey = (date) => new Date(date).toISOString().slice(0, 7);
const monthLabel = (key) => new Date(`${key}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

function Card({ children, style }) {
  return <View style={[{ backgroundColor: C.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.border, gap: 8 }, style]}>{children}</View>;
}

function Kpi({ label, value, color, hint }) {
  return (
    <Card style={{ flex: 1, minWidth: 145 }}>
      <View style={{ width: 38, height: 5, borderRadius: 99, backgroundColor: color }} />
      <Text selectable style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      <Text selectable style={{ color: C.ink, fontSize: 25, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {hint ? <Text selectable style={{ color: C.muted, fontSize: 12 }}>{hint}</Text> : null}
    </Card>
  );
}

function Donut({ values }) {
  const size = 180;
  const stroke = 24;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(1, values.reduce((sum, item) => sum + item.value, 0));
  let offset = 0;
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#EEF2F7" strokeWidth={stroke} fill="none" />
          {values.map((item) => {
            const length = circumference * item.value / total;
            const node = <Circle key={item.label} cx={size / 2} cy={size / 2} r={radius} stroke={item.color} strokeWidth={stroke} fill="none" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt" />;
            offset += length;
            return node;
          })}
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text selectable style={{ fontSize: 12, color: C.muted, fontWeight: '700' }}>CA ENCAISSÉ</Text>
          <Text selectable style={{ fontSize: 24, color: C.ink, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{euro(total)}</Text>
        </View>
      </View>
      <View style={{ width: '100%', gap: 8 }}>
        {values.map((item) => <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} /><Text selectable style={{ flex: 1, color: C.muted, fontWeight: '700' }}>{item.label}</Text><Text selectable style={{ color: C.ink, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{euro(item.value)}</Text></View>)}
      </View>
    </View>
  );
}

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 170, gap: 10, paddingTop: 12 }}>{rows.map((row) => <View key={row.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}><Text selectable style={{ color: C.muted, fontSize: 10, fontWeight: '700' }}>{row.value ? Math.round(row.value / 100) * 100 : ''}</Text><View style={{ width: '78%', minHeight: 4, height: Math.max(4, 118 * row.value / max), borderRadius: 8, backgroundColor: C.blue }} /><Text selectable style={{ color: C.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{monthLabel(row.key)}</Text></View>)}</View>;
}

function Login({ onReady }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  const send = async () => {
    setBusy(true); setError('');
    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
    setBusy(false);
    if (authError) return setError(authError.message);
    setSent(true);
  };
  const verify = async () => {
    setBusy(true); setError('');
    const { data, error: authError } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\D/g, ''), type: 'email' });
    if (authError) { setBusy(false); return setError(authError.message); }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id,role,first_name,last_name').eq('id', data.user.id).single();
    if (profileError || profile?.role !== 'admin') {
      await supabase.auth.signOut(); setBusy(false); return setError('Ce compte ne possède pas le rôle administrateur.');
    }
    setBusy(false); onReady(profile);
  };

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, backgroundColor: C.ink, paddingTop: insets.top + 52, paddingBottom: insets.bottom + 32, paddingHorizontal: 24, justifyContent: 'center', gap: 24 }}>
    <View style={{ gap: 8 }}><Text selectable style={{ color: C.cyan, fontWeight: '900', letterSpacing: 2 }}>EDM28</Text><Text selectable style={{ color: 'white', fontSize: 38, fontWeight: '900' }}>Pilotage mobile</Text><Text selectable style={{ color: '#A9B7CC', fontSize: 16, lineHeight: 24 }}>Tes chiffres et tes demandes, sans les écrans complexes du back-office.</Text></View>
    <Card style={{ borderWidth: 0, gap: 14 }}>
      <Text selectable style={{ color: C.ink, fontSize: 20, fontWeight: '900' }}>Connexion administrateur</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Adresse email" placeholderTextColor="#94A3B8" style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 15, fontSize: 16, color: C.ink }} />
      {sent ? <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" placeholder="Code reçu" placeholderTextColor="#94A3B8" style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 15, fontSize: 20, letterSpacing: 4, color: C.ink }} /> : null}
      {error ? <Text selectable style={{ color: C.red, fontWeight: '700' }}>{error}</Text> : null}
      <Pressable disabled={busy || !email || (sent && code.length < 6)} onPress={sent ? verify : send} style={({ pressed }) => ({ backgroundColor: pressed ? '#1D4ED8' : C.blue, opacity: busy || !email || (sent && code.length < 6) ? .45 : 1, padding: 16, borderRadius: 14, alignItems: 'center' })}>{busy ? <ActivityIndicator color="white" /> : <Text selectable style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>{sent ? 'Valider le code' : 'Recevoir un code'}</Text>}</Pressable>
    </Card>
    <Text selectable style={{ color: '#8290A5', textAlign: 'center', fontSize: 12 }}>Environnement de test staging · aucune donnée de production</Text>
  </ScrollView>;
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ revenue: [], expenses: [], purchases: [], cashflow: [], invoices: [], requests: [] });
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      const user = sessionData.session?.user;
      if (!user) return setLoading(false);
      const { data: p } = await supabase.from('profiles').select('id,role,first_name,last_name').eq('id', user.id).single();
      if (p?.role === 'admin') setProfile(p); else await supabase.auth.signOut();
      setLoading(false);
    });
  }, []);

  const load = useCallback(async () => {
    if (!profile) return;
    const results = await Promise.all([
      supabase.from('admin_revenue_book').select('collection_date,ca_collected,sales_collected,service_collected,disbursement_collected').order('collection_date'),
      supabase.from('business_expenses').select('amount,expense_date,category'),
      supabase.from('admin_purchase_register').select('total,purchase_date'),
      supabase.from('admin_cashflow').select('direction,amount,occurred_at'),
      supabase.from('invoices').select('total,amount_paid,status,issued_at'),
      supabase.from('service_requests').select('id,status,services,notes,totals,created_at,submitted_at,profiles(first_name,last_name,email,phone),vehicles(plate,brand,model)').in('status', ['submitted','reviewed']).order('created_at', { ascending: false }),
    ]);
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
    setData({ revenue: results[0].data || [], expenses: results[1].data || [], purchases: results[2].data || [], cashflow: results[3].data || [], invoices: results[4].data || [], requests: results[5].data || [] });
  }, [profile]);

  useEffect(() => { if (profile) load().catch((e) => Alert.alert('Chargement impossible', e.message)).finally(() => setLoading(false)); }, [profile, load]);
  const refresh = async () => { setRefreshing(true); try { await load(); } catch (e) { Alert.alert('Actualisation impossible', e.message); } finally { setRefreshing(false); } };

  const totals = useMemo(() => {
    const ca = data.revenue.reduce((s, r) => s + num(r.ca_collected), 0);
    const services = data.revenue.reduce((s, r) => s + num(r.service_collected), 0);
    const sales = data.revenue.reduce((s, r) => s + num(r.sales_collected), 0);
    const disbursements = data.revenue.reduce((s, r) => s + num(r.disbursement_collected), 0);
    const expenses = data.expenses.reduce((s, r) => s + num(r.amount), 0) + data.purchases.reduce((s, r) => s + num(r.total), 0);
    const cashIn = data.cashflow.filter((r) => r.direction === 'in').reduce((s, r) => s + num(r.amount), 0);
    const cashOut = data.cashflow.filter((r) => r.direction === 'out').reduce((s, r) => s + num(r.amount), 0);
    const due = data.invoices.reduce((s, r) => s + Math.max(0, num(r.total) - num(r.amount_paid)), 0);
    return { ca, services, sales, disbursements, expenses, cash: cashIn - cashOut, due };
  }, [data]);

  const months = useMemo(() => {
    const now = new Date(); const keys = [];
    for (let i = 5; i >= 0; i--) keys.push(`${new Date(now.getFullYear(), now.getMonth() - i, 1).getFullYear()}-${String(new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth() + 1).padStart(2, '0')}`);
    const map = Object.fromEntries(keys.map((k) => [k, 0]));
    data.revenue.forEach((r) => { const k = monthKey(r.collection_date); if (k in map) map[k] += num(r.ca_collected); });
    return keys.map((key) => ({ key, value: map[key] }));
  }, [data.revenue]);

  const markReviewed = async (id) => {
    const { data: changed, error } = await supabase.from('service_requests').update({ status: 'reviewed' }).eq('id', id).eq('status', 'submitted').select('id');
    if (error) return Alert.alert('Action impossible', error.message);
    if (!changed?.length) return Alert.alert('Demande déjà modifiée', 'Actualise la liste.');
    await load();
  };

  if (loading && !profile) return <View style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={C.cyan} /></View>;
  if (!profile) return <Login onReady={(p) => { setProfile(p); setLoading(true); }} />;

  const contentPadding = width >= 700 ? 34 : 18;
  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    <View style={{ backgroundColor: C.ink, paddingTop: insets.top + 16, paddingHorizontal: contentPadding, paddingBottom: 20, gap: 5 }}><Text selectable style={{ color: C.cyan, fontWeight: '900', letterSpacing: 1.5 }}>EDM28 PILOTAGE</Text><Text selectable style={{ color: 'white', fontSize: 27, fontWeight: '900' }}>{tab === 'home' ? 'Vue essentielle' : tab === 'accounting' ? 'Comptabilité' : 'Demandes à traiter'}</Text><Text selectable style={{ color: '#A9B7CC' }}>{profile.first_name || 'Administrateur'} · staging</Text></View>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.blue} />} contentContainerStyle={{ padding: contentPadding, paddingBottom: 120, gap: 16 }}>
      {tab === 'home' ? <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Kpi label="CA encaissé" value={euro(totals.ca)} color={C.blue} /><Kpi label="À encaisser" value={euro(totals.due)} color={C.orange} /><Kpi label="Dépenses" value={euro(totals.expenses)} color={C.red} /><Kpi label="Trésorerie" value={euro(totals.cash)} color={totals.cash >= 0 ? C.green : C.red} /></View>
        <Card><Text selectable style={{ color: C.ink, fontSize: 18, fontWeight: '900' }}>Activité sur 6 mois</Text><Bars rows={months} /></Card>
        <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View><Text selectable style={{ color: C.ink, fontSize: 18, fontWeight: '900' }}>Demandes prioritaires</Text><Text selectable style={{ color: C.muted }}>À ouvrir et traiter</Text></View><View style={{ backgroundColor: '#DBEAFE', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 }}><Text selectable style={{ color: C.blue, fontSize: 22, fontWeight: '900' }}>{data.requests.length}</Text></View></View><Pressable onPress={() => setTab('requests')} style={{ backgroundColor: C.blue, padding: 14, borderRadius: 14, alignItems: 'center' }}><Text selectable style={{ color: 'white', fontWeight: '900' }}>Voir les demandes</Text></Pressable></Card>
      </> : null}
      {tab === 'accounting' ? <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Kpi label="Prestations" value={euro(totals.services)} color={C.cyan} /><Kpi label="Ventes de pièces" value={euro(totals.sales)} color={C.violet} /><Kpi label="Débours" value={euro(totals.disbursements)} color={C.orange} /><Kpi label="Reste à encaisser" value={euro(totals.due)} color={C.red} /></View>
        <Card><Text selectable style={{ color: C.ink, fontSize: 18, fontWeight: '900' }}>Répartition du chiffre d’affaires</Text><Donut values={[{ label: 'Prestations', value: totals.services, color: C.cyan }, { label: 'Ventes', value: totals.sales, color: C.violet }, { label: 'Autre CA', value: Math.max(0, totals.ca - totals.services - totals.sales), color: C.blue }]} /></Card>
        <Card><Text selectable style={{ color: C.ink, fontSize: 18, fontWeight: '900' }}>Lecture rapide</Text><Text selectable style={{ color: C.muted, lineHeight: 22 }}>Les débours sont affichés séparément. Les chiffres servent au pilotage interne et ne remplacent pas une déclaration officielle.</Text></Card>
      </> : null}
      {tab === 'requests' ? <View style={{ gap: 12 }}>{data.requests.length ? data.requests.map((r) => { const client = r.profiles || {}; const vehicle = r.vehicles || {}; const services = Array.isArray(r.services) ? r.services : []; return <Card key={r.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><Text selectable style={{ color: r.status === 'submitted' ? C.orange : C.blue, fontWeight: '900', textTransform: 'uppercase', fontSize: 12 }}>{r.status === 'submitted' ? 'Nouvelle' : 'Étudiée'}</Text><Text selectable style={{ color: C.ink, fontSize: 19, fontWeight: '900' }}>{`${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email || 'Client'}</Text><Text selectable style={{ color: C.muted }}>{vehicle.plate || 'Sans plaque'} · {`${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule'}</Text></View><Text selectable style={{ color: C.ink, fontWeight: '900' }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</Text></View><Text selectable style={{ color: C.navy, lineHeight: 21 }}>{services.map((s) => s.name || s.id || 'Prestation').join(' · ') || 'Aucune prestation indiquée'}</Text>{r.notes ? <Text selectable style={{ color: C.muted, fontStyle: 'italic' }}>« {r.notes} »</Text> : null}{r.status === 'submitted' ? <Pressable onPress={() => markReviewed(r.id)} style={{ backgroundColor: C.blue, padding: 14, borderRadius: 14, alignItems: 'center' }}><Text selectable style={{ color: 'white', fontWeight: '900' }}>Marquer étudiée</Text></Pressable> : null}</Card>; }) : <Card><Text selectable style={{ color: C.muted, textAlign: 'center' }}>Aucune demande à traiter.</Text></Card>}</View> : null}
    </ScrollView>
    <View style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(12, insets.bottom), backgroundColor: C.ink, borderRadius: 22, flexDirection: 'row', padding: 7 }}>
      {[['home','Accueil'],['accounting','Comptabilité'],['requests','Demandes']].map(([key, label]) => <Pressable key={key} onPress={() => setTab(key)} style={{ flex: 1, backgroundColor: tab === key ? C.blue : 'transparent', borderRadius: 16, paddingVertical: 13, alignItems: 'center' }}><Text selectable style={{ color: 'white', fontWeight: '900', fontSize: 12 }}>{label}</Text></Pressable>)}
    </View>
  </View>;
}

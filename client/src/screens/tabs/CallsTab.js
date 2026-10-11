import React, { useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../../components/UserAvatar';

const CallRowItem = ({ item, theme, onDial }) => {
  const isMissed = item.direction === 'missed';
  const isIncoming = item.direction === 'incoming';

  return (
    <View style={styles.callRow}>
      <UserAvatar
        uri={item.user.avatar}
        name={item.user.name}
        size={48}
        showBadge={false}
      />
      <View style={styles.callInfo}>
        <Text
          style={[
            styles.userName,
            { color: isMissed ? theme.danger : theme.text },
          ]}
          numberOfLines={1}
        >
          {item.user.name}
        </Text>
        <View style={styles.callMetaRow}>
          <MaterialIcons
            name={
              isMissed
                ? 'call-missed'
                : isIncoming
                ? 'call-received'
                : 'call-made'
            }
            size={14}
            color={
              isMissed
                ? theme.danger
                : isIncoming
                ? theme.accent
                : theme.primary
            }
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.callMeta, { color: theme.textSecondary }]}>
            {item.time} • {item.duration}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.dialBtn, { backgroundColor: theme.primaryMuted }]}
        onPress={() => onDial(item.user, item.type)}
        activeOpacity={0.7}
      >
        <Feather
          name={item.type === 'video' ? 'video' : 'phone'}
          size={17}
          color={theme.primary}
        />
      </TouchableOpacity>
    </View>
  );
};

export const CallsTab = () => {
  const { themeMode, calls, addCallRecord } = useApp();
  const theme = Colors[themeMode];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Calls</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <Feather name="phone-call" size={17} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        )}
        renderItem={({ item }) => (
          <CallRowItem item={item} theme={theme} onDial={addCallRecord} />
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 100, paddingHorizontal: 32 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.inputBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Feather name="phone-off" size={28} color={theme.textMuted} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 6 }}>
              No Call Logs
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center' }}>
              Your incoming and outgoing audio and video calls will appear here.
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: 6,
    paddingBottom: 24,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 80,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  callInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15.5,
    fontWeight: '600',
    marginBottom: 3,
  },
  callMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callMeta: {
    fontSize: 12.5,
  },
  dialBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

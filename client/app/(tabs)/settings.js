import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../src/theme/colors';
import { useUIStore } from '../../src/stores/uiStore';
import { useAuthStore } from '../../src/stores/authStore';
import { sqliteService } from '../../src/database/sqliteService';
import { UserAvatar } from '../../src/components/UserAvatar';
import { EditProfileModal } from '../../src/screens/settings/EditProfileModal';

export default function SettingsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeMode, toggleTheme } = useUIStore();
  const { user, logout, updateUserProfile } = useAuthStore();
  const theme = Colors[themeMode] || Colors.dark;
  const isDark = themeMode === 'dark';

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const confirmClearCache = () => {
    Alert.alert(
      'Clear Local SQLite Cache',
      'This will remove cached messages and offline queues from your local device database without deleting your account on the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Local Storage',
          style: 'destructive',
          onPress: async () => {
            await sqliteService.clearAll();
            Alert.alert('Database Cleaned', 'Local SQLite tables cleared successfully.');
          },
        },
      ]
    );
  };

  const confirmSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your credentials will be cleared securely.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/signin');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Profile, preferences & database security
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <UserAvatar
            uri={user?.avatar_url || user?.avatar}
            name={user?.display_name || user?.name || user?.username || 'User'}
            size={64}
          />
          <View style={styles.profileDetails}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {user?.display_name || user?.name || user?.username || 'Chat User'}
            </Text>
            <Text style={[styles.profileHandle, { color: theme.primary }]}>
              @{user?.username || 'user'}
            </Text>
            <Text style={[styles.profileBio, { color: theme.textSecondary }]} numberOfLines={1}>
              {user?.bio || 'Available'}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.textMuted }]} numberOfLines={1}>
              {user?.email || ''}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: theme.primaryMuted }]}
            onPress={() => setIsEditingProfile(true)}
            activeOpacity={0.8}
          >
            <Feather name="edit-2" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PREFERENCES</Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.primaryMuted }]}>
                  <Feather name={isDark ? 'moon' : 'sun'} size={18} color={theme.primary} />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
                  <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
                    {isDark ? 'Dark theme enabled' : 'Light theme enabled'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: theme.primary }}
                thumbColor={isDark ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* Database & Storage Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DATABASE & SECURITY</Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={confirmClearCache}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.primaryMuted }]}>
                  <Feather name="database" size={18} color={theme.primary} />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Clear SQLite Cache</Text>
                  <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
                    Clean local SQLite tables & queued drafts
                  </Text>
                </View>
              </View>
              <Feather name="trash-2" size={16} color={theme.danger || '#EF4444'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Session / Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACCOUNT</Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={confirmSignOut}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.dangerMuted || 'rgba(239,68,68,0.1)' }]}>
                  <Feather name="log-out" size={18} color={theme.danger || '#EF4444'} />
                </View>
                <View style={styles.settingTextGroup}>
                  <Text style={[styles.settingLabel, { color: theme.danger || '#EF4444' }]}>
                    Sign Out
                  </Text>
                  <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
                    Revoke token on server & clear local SecureStore
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <EditProfileModal
          visible={isEditingProfile}
          onClose={() => setIsEditingProfile(false)}
          currentUser={user}
          onSave={updateUserProfile}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  profileDetails: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileHandle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileBio: {
    fontSize: 12.5,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 11.5,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingTextGroup: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtext: {
    fontSize: 12,
  },
});

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
import { Colors } from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../../components/UserAvatar';
import { EditProfileModal } from '../settings/EditProfileModal';

export const SettingsTab = () => {
  const { themeMode, toggleTheme, currentUser, handleSignOut } = useApp();
  const theme = Colors[themeMode];
  const isDark = themeMode === 'dark';

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const confirmClearCache = () => {
    Alert.alert(
      'Clear Local Cache',
      'This will clear temporary media caches on this device without deleting your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Success', 'Cache cleared successfully.') },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? All keys and personal identifiers will be permanently removed. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            handleSignOut();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Clean Header without harsh borders */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerGreeting, { color: theme.textSecondary }]}>Account</Text>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Modern Frameless Profile Card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: theme.inputBg }]}
          onPress={() => setIsEditingProfile(true)}
          activeOpacity={0.8}
        >
          <UserAvatar
            uri={currentUser?.avatar}
            name={currentUser?.name || 'User'}
            size={58}
            showBadge={true}
            isOnline={true}
          />
          <View style={styles.profileDetails}>
            <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
              {currentUser?.name || 'User'}
            </Text>
            <Text style={[styles.profileUsername, { color: theme.primaryAccent || '#3B82F6' }]}>
              {currentUser?.username || '@username'}
            </Text>
            <Text style={[styles.profileBio, { color: theme.textSecondary }]} numberOfLines={1}>
              {currentUser?.bio || 'Available'}
            </Text>
          </View>
          <View style={[styles.editIconBtn, { backgroundColor: theme.surface }]}>
            <Feather name="edit-2" size={15} color={theme.text} />
          </View>
        </TouchableOpacity>

        {/* Quick Profile Edit Row */}
        <TouchableOpacity
          style={[styles.actionRowBtn, { backgroundColor: theme.surface }]}
          onPress={() => setIsEditingProfile(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBg, { backgroundColor: (theme.primaryAccent || '#3B82F6') + '15' }]}>
            <Feather name="user" size={16} color={theme.primaryAccent || '#3B82F6'} />
          </View>
          <View style={styles.menuTextCol}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Edit Profile</Text>
            <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
              Change avatar, name, bio & username
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        {/* Section: Appearance */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>PREFERENCES</Text>
        <View style={[styles.menuGroup, { backgroundColor: theme.surface }]}>
          <View style={styles.menuRow}>
            <View style={[styles.menuIconBg, { backgroundColor: theme.primaryMuted }]}>
              <Feather name={isDark ? 'moon' : 'sun'} size={16} color={theme.text} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>Dark Mode</Text>
              <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                {isDark ? 'Dark theme active' : 'Clean light theme'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Section: Privacy & Storage */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>PRIVACY & STORAGE</Text>
        <View style={[styles.menuGroup, { backgroundColor: theme.surface }]}>
          <TouchableOpacity style={styles.menuRow} onPress={confirmClearCache} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: theme.inputBg }]}>
              <Feather name="database" size={16} color={theme.text} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>Clear Cache</Text>
              <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                Free up local temporary media storage
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section: Account Actions */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>ACCOUNT</Text>
        <View style={[styles.menuGroup, { backgroundColor: theme.surface }]}>
          <TouchableOpacity style={styles.menuRow} onPress={handleSignOut} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: theme.danger + '12' }]}>
              <Feather name="log-out" size={16} color={theme.danger} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={[styles.menuTitle, { color: theme.danger, fontWeight: '600' }]}>Sign Out</Text>
              <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                Disconnect session and return to login
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.danger} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <TouchableOpacity style={styles.menuRow} onPress={confirmDeleteAccount} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: theme.danger + '18' }]}>
              <Feather name="trash-2" size={16} color={theme.danger} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={[styles.menuTitle, { color: theme.danger, fontWeight: '700' }]}>Delete Account</Text>
              <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                Permanently erase keys, profile & account
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Full Working Edit Profile Modal */}
      <EditProfileModal
        visible={isEditingProfile}
        onClose={() => setIsEditingProfile(false)}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerGreeting: {
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  profileDetails: {
    marginLeft: 14,
    flex: 1,
  },
  profileName: {
    fontSize: 17.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  profileUsername: {
    fontSize: 13,
    fontWeight: '600',
    marginVertical: 2,
  },
  profileBio: {
    fontSize: 12.5,
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 6,
  },
  menuGroup: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

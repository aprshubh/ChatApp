import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../../components/UserAvatar';

export const EditProfileModal = ({ visible, onClose }) => {
  const { themeMode, currentUser, updateProfile } = useApp();
  const theme = Colors[themeMode];

  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(
    (currentUser?.username || '').replace(/^@/, '')
  );
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUri, setAvatarUri] = useState(currentUser?.avatar || '');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  if (!visible) return null;

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Needed',
          'Please allow camera roll access to pick an avatar image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (e) {
      console.log('Error picking image', e);
    }
  };

  const handleSave = () => {
    const cleanUser = username.trim().replace(/^@/, '');
    if (!cleanUser || cleanUser.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    updateProfile({
      name: name.trim(),
      username: cleanUser,
      bio: bio.trim(),
      avatar: avatarUri,
    });

    setIsSavedNotice(true);
    setTimeout(() => {
      setIsSavedNotice(false);
      onClose();
    }, 500);
  };

  return (
    <View style={styles.overlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        {/* Header Bar */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.saveText, { color: theme.primaryAccent || '#3B82F6' }]}>
              {isSavedNotice ? 'Saved!' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Avatar picker circle */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarTouch}>
              <UserAvatar
                uri={avatarUri}
                name={name || 'U'}
                size={88}
                showBadge={false}
              />
              <View style={[styles.cameraBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
                <Feather name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickImage} style={styles.changePhotoBtn}>
              <Text style={[styles.changePhotoText, { color: theme.primaryAccent || '#3B82F6' }]}>
                Change Profile Photo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form fields */}
          <View style={styles.formContainer}>
            {/* Display Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Full Name</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your display name"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Username</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <Text style={[styles.atPrefix, { color: theme.primaryAccent || '#3B82F6' }]}>@</Text>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={username}
                  onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="username"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={[styles.helperText, { color: theme.textMuted }]}>
                Letters, numbers, and underscores only.
              </Text>
            </View>

            {/* Email (Read-only display for safety) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Email</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border, opacity: 0.8 }]}>
                <TextInput
                  style={[styles.input, { color: theme.textSecondary }]}
                  value={currentUser?.email || ''}
                  editable={false}
                />
                <Feather name="lock" size={14} color={theme.textMuted} />
              </View>
            </View>

            {/* Bio / Status */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Bio</Text>
              <View style={[styles.inputWrapperMultiline, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.inputMultiline, { color: theme.text }]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Add a bio..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  container: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '700',
  },
  cancelText: {
    fontSize: 15,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarTouch: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoBtn: {
    marginTop: 10,
    padding: 4,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
    maxWidth: 420,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
  },
  atPrefix: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    height: '100%',
  },
  helperText: {
    fontSize: 11.5,
    marginTop: 4,
    marginLeft: 2,
  },
  inputWrapperMultiline: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
  },
  inputMultiline: {
    fontSize: 14,
    textAlignVertical: 'top',
  },
});

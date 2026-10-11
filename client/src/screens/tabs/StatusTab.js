import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../../components/UserAvatar';

export const StatusTab = () => {
  const { themeMode, statuses, currentUser, markStatusViewed } = useApp();
  const theme = Colors[themeMode];

  const [activeStory, setActiveStory] = useState(null);

  const openStory = (story) => {
    markStatusViewed(story.id);
    setActiveStory(story);
  };

  const recentStories = statuses.filter((s) => !s.viewed);
  const viewedStories = statuses.filter((s) => s.viewed);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Status</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <Feather name="camera" size={17} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* My Status Card */}
        <TouchableOpacity style={styles.statusRow} activeOpacity={0.7}>
          <View style={styles.myAvatarWrapper}>
            <UserAvatar
              uri={currentUser?.avatar}
              name={currentUser?.name || 'Me'}
              size={52}
              showBadge={false}
            />
            <View style={[styles.plusBadge, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
              <Feather name="plus" size={12} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.statusInfo}>
            <Text style={[styles.statusTitle, { color: theme.text }]}>My Status</Text>
            <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
              Tap to add status update
            </Text>
          </View>
        </TouchableOpacity>

        {/* Recent Updates Header */}
        {recentStories.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              RECENT UPDATES
            </Text>
          </View>
        )}

        {/* Recent Stories List */}
        {recentStories.map((story) => (
          <TouchableOpacity
            key={story.id}
            style={styles.statusRow}
            activeOpacity={0.7}
            onPress={() => openStory(story)}
          >
            <View style={[styles.storyRing, { borderColor: theme.primary }]}>
              <UserAvatar
                uri={story.user.avatar}
                name={story.user.name}
                size={46}
                showBadge={false}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>{story.user.name}</Text>
              <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
                {story.timeAgo}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Viewed Updates Header */}
        {viewedStories.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              VIEWED UPDATES
            </Text>
          </View>
        )}

        {/* Viewed Stories List */}
        {viewedStories.map((story) => (
          <TouchableOpacity
            key={story.id}
            style={styles.statusRow}
            activeOpacity={0.7}
            onPress={() => openStory(story)}
          >
            <View style={[styles.storyRing, { borderColor: theme.border }]}>
              <UserAvatar
                uri={story.user.avatar}
                name={story.user.name}
                size={46}
                showBadge={false}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>{story.user.name}</Text>
              <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
                {story.timeAgo}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Story Fullscreen Preview Modal */}
      <Modal visible={!!activeStory} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          {activeStory && (
            <View style={styles.modalContent}>
              <Image source={{ uri: activeStory.mediaUrl }} style={styles.storyImage} />

              {/* Story Top Bar */}
              <View style={styles.storyTopBar}>
                <UserAvatar
                  uri={activeStory.user.avatar}
                  name={activeStory.user.name}
                  size={36}
                  showBadge={false}
                />
                <View style={styles.storyMeta}>
                  <Text style={styles.storyAuthor}>{activeStory.user.name}</Text>
                  <Text style={styles.storyTime}>{activeStory.timeAgo}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setActiveStory(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="x" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Story Caption */}
              {activeStory.caption ? (
                <View style={styles.captionBox}>
                  <Text style={styles.captionText}>{activeStory.caption}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </Modal>
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
  scrollContent: {
    paddingVertical: 10,
    paddingBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  myAvatarWrapper: {
    position: 'relative',
  },
  plusBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInfo: {
    marginLeft: 14,
    flex: 1,
  },
  statusTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 13,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  storyRing: {
    padding: 2,
    borderRadius: 28,
    borderWidth: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  storyTopBar: {
    position: 'absolute',
    top: 50,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyMeta: {
    marginLeft: 10,
    flex: 1,
  },
  storyAuthor: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14.5,
  },
  storyTime: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  closeBtn: {
    padding: 6,
  },
  captionBox: {
    position: 'absolute',
    bottom: 50,
    left: 18,
    right: 18,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
});

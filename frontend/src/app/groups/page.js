"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createGroup,
  createGroupComment,
  createGroupEvent,
  createGroupPost,
  getFollowers,
  getGroup,
  getGroupInvitations,
  getGroups,
  getGroupPost,
  inviteToGroup,
  requestToJoinGroup,
  respondToGroupEvent,
  respondToGroupInvitation,
  respondToGroupJoinRequest,
} from "@/lib/api";
import { MaxImageSizeBytes, MaxImageSizeMB } from "@/lib/limits";
import Notification from "@/components/ui/Notification";
import GroupSidebar from "./GroupSidebar";
import GroupDetail from "./GroupDetail";
import {
  appendMentionTrigger,
  displayName,
  getMentionSuggestions,
  getSubmitForm,
  hasActiveMention,
  replaceMentionToken,
  formatDateTimeLocal,
} from "./groupHelpers";
import styles from "./Groups.module.css";

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [detail, setDetail] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState({});
  const [createInviteIds, setCreateInviteIds] = useState([]);
  const [memberInviteId, setMemberInviteId] = useState("");
  const [postImage, setPostImage] = useState(null);
  const [commentImages, setCommentImages] = useState({});
  const [drafts, setDrafts] = useState({
    title: "",
    description: "",
    invitees: "",
    inviteUser: "",
    post: "",
    eventTitle: "",
    eventDescription: "",
    eventTime: "",
  });
  const [commentDrafts, setCommentDrafts] = useState({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeInviteField, setActiveInviteField] = useState("");

  const refreshGroups = useCallback(async () => {
    try {
      const [groupList, inviteList, followerList] = await Promise.all([
        getGroups(),
        getGroupInvitations(),
        getFollowers(),
      ]);
      setGroups(groupList || []);
      setInvitations(inviteList || []);
      setFollowers(followerList || []);
      if (!selectedGroupId && groupList?.[0]) {
        setSelectedGroupId(groupList[0].id);
      }
    } catch (err) {
      setError(err.message || "Could not load groups");
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroupId]);

  const loadGroup = useCallback(async (groupId) => {
    try {
      const nextDetail = await getGroup(groupId);
      setDetail(nextDetail);
      setExpandedPosts({});
    } catch (err) {
      setError(err.message || "Could not load group");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialGroups() {
      try {
        const [groupList, inviteList, followerList] = await Promise.all([
          getGroups(),
          getGroupInvitations(),
          getFollowers(),
        ]);
        if (!isMounted) return;
        setGroups(groupList || []);
        setInvitations(inviteList || []);
        setFollowers(followerList || []);
        if (!selectedGroupId && groupList?.[0]) {
          setSelectedGroupId(groupList[0].id);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Could not load groups");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialGroups();
    return () => {
      isMounted = false;
    };
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    let isMounted = true;

    async function loadSelectedGroup() {
      try {
        const nextDetail = await getGroup(selectedGroupId);
        if (!isMounted) return;
        setDetail(nextDetail);
        setExpandedPosts({});
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Could not load group");
        }
      }
    }

    loadSelectedGroup();
    return () => {
      isMounted = false;
    };
  }, [selectedGroupId]);

  const selectedGroup = detail?.group;
  const isMember = Boolean(selectedGroup?.is_member);
  const isCreator = Boolean(detail?.requests);
  const minEventTime = formatDateTimeLocal(new Date());
  const createInviteSuggestions = useMemo(
    () => getMentionSuggestions(drafts.invitees, followers, true, createInviteIds),
    [drafts.invitees, followers, createInviteIds],
  );
  const memberInviteSuggestions = useMemo(
    () =>
      getMentionSuggestions(drafts.inviteUser, followers, false, memberInviteId ? [memberInviteId] : []),
    [drafts.inviteUser, followers, memberInviteId],
  );

  function updateDraft(key, value) {
    setDrafts((current) => ({ ...current, [key]: value }));
  }

  function focusInviteField(field, key) {
    setActiveInviteField(field);
    setDrafts((current) => {
      const value = current[key];
      if (hasActiveMention(value, field === "create")) {
        return current;
      }

      return { ...current, [key]: appendMentionTrigger(value, field === "create") };
    });
  }

  function clearActiveInviteField() {
    setActiveInviteField("");
  }

  function selectCreateInvite(user) {
    setCreateInviteIds((current) => (current.includes(user.id) ? current : [...current, user.id]));
    updateDraft("invitees", replaceMentionToken(drafts.invitees, displayName(user), true));
    setActiveInviteField("create");
  }

  function selectMemberInvite(user) {
    if (!user) {
      setMemberInviteId("");
      return;
    }
    setMemberInviteId(user.id);
    updateDraft("inviteUser", displayName(user));
    setActiveInviteField("member");
  }

  function handleCreateInviteChange(value) {
    updateDraft("invitees", value);
    const labels = new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    );
    setCreateInviteIds((current) =>
      current.filter((userId) => {
        const user = followers.find((item) => item.id === userId);
        return user && labels.has(displayName(user).toLowerCase());
      }),
    );
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    setError("");
    try {
      const group = await createGroup({
        title: drafts.title,
        description: drafts.description,
        inviteeUserIds: createInviteIds,
      });
      setDrafts((current) => ({
        ...current,
        title: "",
        description: "",
        invitees: "",
      }));
      setCreateInviteIds([]);
      await refreshGroups();
      setSelectedGroupId(group.id);
    } catch (err) {
      setError(err.message || "Could not create group");
    }
  }

  async function handleRequestJoin(groupId) {
    setError("");
    try {
      await requestToJoinGroup(groupId);
      await refreshGroups();
      await loadGroup(groupId);
    } catch (err) {
      setError(err.message || "Could not request access");
    }
  }

  async function handleInvitation(groupId, status) {
    setError("");
    try {
      await respondToGroupInvitation(groupId, status);
      await refreshGroups();
      await loadGroup(groupId);
    } catch (err) {
      setError(err.message || "Could not update invitation");
    }
  }

  async function handleJoinRequest(userId, status) {
    setError("");
    try {
      await respondToGroupJoinRequest(selectedGroupId, userId, status);
      await loadGroup(selectedGroupId);
      await refreshGroups();
    } catch (err) {
      setError(err.message || "Could not update request");
    }
  }

  async function handleInvite(event) {
    event.preventDefault();
    if (!memberInviteId || !selectedGroupId) return;
    setError("");
    try {
      await inviteToGroup(selectedGroupId, memberInviteId);
      updateDraft("inviteUser", "");
      setMemberInviteId("");
    } catch (err) {
      setError(err.message || "Could not invite user");
    }
  }

  function handleFileChange(file, setter) {
    if (file && file.size > MaxImageSizeBytes) {
      setter(null);
      setError(`Images must be ${MaxImageSizeMB} MB or smaller`);
      return;
    }
    setter(file);
  }

  function handlePostImageChange(file) {
    handleFileChange(file, setPostImage);
  }

  function handleCommentImageChange(postId, file) {
    if (postId == null) {
      handlePostImageChange(file);
      return;
    }
    handleFileChange(file, (nextFile) =>
      setCommentImages((current) => ({ ...current, [postId]: nextFile })),
    );
  }

  async function handleCreatePost(event) {
    event.preventDefault();
    const form = getSubmitForm(event);
    setError("");
    try {
      const post = await createGroupPost(selectedGroupId, {
        content: drafts.post,
        image: postImage,
      });
      setDetail((current) => ({
        ...current,
        posts: [post, ...(current?.posts || [])],
      }));
      updateDraft("post", "");
      setPostImage(null);
      form?.reset();
    } catch (err) {
      setError(err.message || "Could not create post");
    }
  }

  async function handleToggleComments(postId) {
    if (expandedPosts[postId]) {
      setExpandedPosts((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
      return;
    }
    setError("");
    try {
      const postDetail = await getGroupPost(selectedGroupId, postId);
      setExpandedPosts((current) => ({
        ...current,
        [postId]: postDetail.comments || [],
      }));
    } catch (err) {
      setError(err.message || "Could not load comments");
    }
  }

  async function handleCreateComment(event, postId) {
    event.preventDefault();
    const form = getSubmitForm(event);
    setError("");
    try {
      const comment = await createGroupComment(selectedGroupId, postId, {
        content: commentDrafts[postId] || "",
        image: commentImages[postId] || null,
      });
      setExpandedPosts((current) => ({
        ...current,
        [postId]: [...(current[postId] || []), comment],
      }));
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      setCommentImages((current) => ({ ...current, [postId]: null }));
      form?.reset();
    } catch (err) {
      setError(err.message || "Could not add comment");
    }
  }

  async function handleCreateEvent(event) {
    event.preventDefault();
    setError("");
    try {
      const eventDate = new Date(drafts.eventTime);
      if (!drafts.eventTime || Number.isNaN(eventDate.getTime())) {
        setError("event title and day/time are required");
        return;
      }
      if (eventDate <= new Date()) {
        setError("event time must be in the future");
        return;
      }
      const eventTime = eventDate.toISOString();
      const groupEvent = await createGroupEvent(selectedGroupId, {
        title: drafts.eventTitle,
        description: drafts.eventDescription,
        eventTime,
      });
      setDetail((current) => ({
        ...current,
        events: [...(current?.events || []), groupEvent],
      }));
      setDrafts((current) => ({
        ...current,
        eventTitle: "",
        eventDescription: "",
        eventTime: "",
      }));
    } catch (err) {
      setError(err.message || "Could not create event");
    }
  }

  async function handleEventResponse(eventId, response) {
    setError("");
    try {
      await respondToGroupEvent(selectedGroupId, eventId, response);
      await loadGroup(selectedGroupId);
    } catch (err) {
      setError(err.message || "Could not save event response");
    }
  }

  return (
    <div className={styles.groupsPage}>
      <Notification message={error} type="error" onClose={() => setError("")} />
      <GroupSidebar
        groups={groups}
        selectedGroupId={selectedGroupId}
        isLoading={isLoading}
        invitations={invitations}
        drafts={drafts}
        activeInviteField={activeInviteField}
        createInviteSuggestions={createInviteSuggestions}
        onGroupSelect={setSelectedGroupId}
        onDraftChange={updateDraft}
        onCreateInviteChange={handleCreateInviteChange}
        onFocusInviteField={focusInviteField}
        onClearActiveInviteField={clearActiveInviteField}
        onCreateGroup={handleCreateGroup}
        onSelectCreateInvite={selectCreateInvite}
        onInvitationResponse={handleInvitation}
      />
      <GroupDetail
        selectedGroup={selectedGroup}
        detail={detail}
        isMember={isMember}
        isCreator={isCreator}
        drafts={drafts}
        postImage={postImage}
        commentDrafts={commentDrafts}
        commentImages={commentImages}
        expandedPosts={expandedPosts}
        activeInviteField={activeInviteField}
        memberInviteSuggestions={memberInviteSuggestions}
        minEventTime={minEventTime}
        onDraftChange={updateDraft}
        onCreatePost={handleCreatePost}
        onToggleComments={handleToggleComments}
        onCreateComment={handleCreateComment}
        onCreateEvent={handleCreateEvent}
        onEventResponse={handleEventResponse}
        onInvite={handleInvite}
        onJoinRequest={handleRequestJoin}
        onFocusInviteField={focusInviteField}
        onSelectMemberInvite={selectMemberInvite}
        onCommentDraftChange={(postId, value) =>
          setCommentDrafts((current) => ({ ...current, [postId]: value }))
        }
        onPostImageChange={handlePostImageChange}
        onCommentImageChange={handleCommentImageChange}
      />
    </div>
  );
}

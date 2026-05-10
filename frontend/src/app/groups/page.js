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
import styles from "./Groups.module.css";

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [detail, setDetail] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState({});
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
  const inviteeNicknames = useMemo(() => parseNicknames(drafts.invitees), [drafts.invitees]);
  const minEventTime = formatDateTimeLocal(new Date());
  const createInviteSuggestions = useMemo(
    () => getMentionSuggestions(drafts.invitees, followers, true),
    [drafts.invitees, followers],
  );
  const memberInviteSuggestions = useMemo(
    () => getMentionSuggestions(drafts.inviteUser, followers, false),
    [drafts.inviteUser, followers],
  );

  function updateDraft(key, value) {
    setDrafts((current) => ({ ...current, [key]: value }));
  }

  function selectCreateInvite(nickname) {
    updateDraft("invitees", replaceMentionToken(drafts.invitees, nickname, true));
    setActiveInviteField("create");
  }

  function selectMemberInvite(nickname) {
    updateDraft("inviteUser", `@${nickname}`);
    setActiveInviteField("member");
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    setError("");
    try {
      const group = await createGroup({
        title: drafts.title,
        description: drafts.description,
        inviteeNicknames,
      });
      setDrafts((current) => ({
        ...current,
        title: "",
        description: "",
        invitees: "",
      }));
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
    const nickname = normalizeNickname(drafts.inviteUser);
    if (!nickname || !selectedGroupId) return;
    setError("");
    try {
      await inviteToGroup(selectedGroupId, nickname);
      updateDraft("inviteUser", "");
    } catch (err) {
      setError(err.message || "Could not invite user");
    }
  }

  async function handleCreatePost(event) {
    event.preventDefault();
    setError("");
    try {
      const post = await createGroupPost(selectedGroupId, drafts.post);
      setDetail((current) => ({
        ...current,
        posts: [post, ...(current?.posts || [])],
      }));
      updateDraft("post", "");
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
    setError("");
    try {
      const comment = await createGroupComment(
        selectedGroupId,
        postId,
        commentDrafts[postId] || "",
      );
      setExpandedPosts((current) => ({
        ...current,
        [postId]: [...(current[postId] || []), comment],
      }));
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
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
      <aside className={styles.sidebar}>
        <section className={styles.panel}>
          <h1>Groups</h1>
          {isLoading ? (
            <p className={styles.muted}>Loading groups...</p>
          ) : groups.length === 0 ? (
            <p className={styles.muted}>No groups yet.</p>
          ) : (
            <div className={styles.groupList}>
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={group.id === selectedGroupId ? styles.activeGroup : ""}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <strong>{group.title}</strong>
                  <span>{group.member_count} members</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <h2>Create Group</h2>
          <form className={styles.stackForm} onSubmit={handleCreateGroup}>
            <input
              value={drafts.title}
              onChange={(event) => updateDraft("title", event.target.value)}
              placeholder="Title"
            />
            <textarea
              value={drafts.description}
              onChange={(event) => updateDraft("description", event.target.value)}
              placeholder="Description"
              rows={3}
            />
            <div className={styles.suggestField}>
              <input
                value={drafts.invitees}
                onFocus={() => setActiveInviteField("create")}
                onBlur={() => setTimeout(() => setActiveInviteField(""), 120)}
                onChange={(event) => updateDraft("invitees", event.target.value)}
                placeholder="Invite nicknames, comma separated"
              />
              {activeInviteField === "create" && createInviteSuggestions.length > 0 && (
                <InviteSuggestions
                  users={createInviteSuggestions}
                  onSelect={selectCreateInvite}
                />
              )}
            </div>
            <button type="submit">Create</button>
          </form>
        </section>

        {invitations.length > 0 && (
          <section className={styles.panel}>
            <h2>Invitations</h2>
            <div className={styles.invitationList}>
              {invitations.map((invitation) => (
                <div key={invitation.id} className={styles.requestRow}>
                  <span>{invitation.group.title}</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => handleInvitation(invitation.group_id, "accepted")}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInvitation(invitation.group_id, "declined")}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      <main className={styles.groupMain}>
        {error && <p className={styles.error}>{error}</p>}
        {!selectedGroup ? (
          <section className={styles.emptyState}>Select or create a group.</section>
        ) : (
          <>
            <section className={styles.panel}>
              <div className={styles.groupHeader}>
                <div>
                  <h1>{selectedGroup.title}</h1>
                  <p>{selectedGroup.description || "No description."}</p>
                  <span>
                    Created by {displayName(selectedGroup.creator)} ·{" "}
                    {selectedGroup.member_count} members
                  </span>
                </div>
                {!isMember && (
                  <button
                    type="button"
                    disabled={selectedGroup.has_request}
                    onClick={() => handleRequestJoin(selectedGroup.id)}
                  >
                    {selectedGroup.has_request ? "Requested" : "Request to join"}
                  </button>
                )}
              </div>
            </section>

            {isMember ? (
              <div className={styles.contentGrid}>
                <section className={styles.panel}>
                  <h2>Group Feed</h2>
                  <form className={styles.composer} onSubmit={handleCreatePost}>
                    <textarea
                      value={drafts.post}
                      onChange={(event) => updateDraft("post", event.target.value)}
                      placeholder="Share with this group"
                      rows={3}
                    />
                    <button type="submit">Post</button>
                  </form>
                  <div className={styles.postList}>
                    {(detail.posts || []).map((post) => (
                      <article key={post.id} className={styles.post}>
                        <header>
                          <strong>{displayName(post.author)}</strong>
                          <span>{formatDate(post.created_at)}</span>
                        </header>
                        <p>{post.content}</p>
                        <button type="button" onClick={() => handleToggleComments(post.id)}>
                          {expandedPosts[post.id] ? "Hide comments" : "View comments"}
                        </button>
                        {expandedPosts[post.id] && (
                          <div className={styles.comments}>
                            {(expandedPosts[post.id] || []).map((comment) => (
                              <div key={comment.id} className={styles.comment}>
                                <strong>{displayName(comment.author)}</strong>
                                <span>{comment.content}</span>
                              </div>
                            ))}
                            <form onSubmit={(event) => handleCreateComment(event, post.id)}>
                              <input
                                value={commentDrafts[post.id] || ""}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [post.id]: event.target.value,
                                  }))
                                }
                                placeholder="Write a comment"
                              />
                              <button type="submit">Send</button>
                            </form>
                          </div>
                        )}
                      </article>
                    ))}
                    {detail.posts?.length === 0 && (
                      <p className={styles.muted}>No group posts yet.</p>
                    )}
                  </div>
                </section>

                <aside className={styles.sideColumn}>
                  <section className={styles.panel}>
                    <h2>Events</h2>
                    <form className={styles.stackForm} onSubmit={handleCreateEvent}>
                      <input
                        value={drafts.eventTitle}
                        onChange={(event) => updateDraft("eventTitle", event.target.value)}
                        placeholder="Title"
                      />
                      <textarea
                        value={drafts.eventDescription}
                        onChange={(event) =>
                          updateDraft("eventDescription", event.target.value)
                        }
                        placeholder="Description"
                        rows={2}
                      />
                      <input
                        type="datetime-local"
                        value={drafts.eventTime}
                        min={minEventTime}
                        onChange={(event) => updateDraft("eventTime", event.target.value)}
                      />
                      <button type="submit">Create event</button>
                    </form>
                    <div className={styles.eventList}>
                      {(detail.events || []).map((event) => (
                        <article key={event.id} className={styles.event}>
                          <strong>{event.title}</strong>
                          <span>{formatDate(event.event_time)}</span>
                          <p>{event.description}</p>
                          <div className={styles.eventActions}>
                            <button
                              type="button"
                              className={event.my_response === "going" ? styles.selected : ""}
                              onClick={() => handleEventResponse(event.id, "going")}
                            >
                              Going {event.going_count}
                            </button>
                            <button
                              type="button"
                              className={
                                event.my_response === "not_going" ? styles.selected : ""
                              }
                              onClick={() => handleEventResponse(event.id, "not_going")}
                            >
                              Not going {event.not_going_count}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className={styles.panel}>
                    <h2>Members</h2>
                    <div className={styles.memberList}>
                      {(detail.members || []).map((member) => (
                        <span key={member.id}>{displayName(member)}</span>
                      ))}
                    </div>
                    <form className={styles.inlineForm} onSubmit={handleInvite}>
                      <div className={styles.suggestField}>
                        <input
                          value={drafts.inviteUser}
                          onFocus={() => setActiveInviteField("member")}
                          onBlur={() => setTimeout(() => setActiveInviteField(""), 120)}
                          onChange={(event) => updateDraft("inviteUser", event.target.value)}
                          placeholder="Nickname"
                        />
                        {activeInviteField === "member" &&
                          memberInviteSuggestions.length > 0 && (
                            <InviteSuggestions
                              users={memberInviteSuggestions}
                              onSelect={selectMemberInvite}
                            />
                          )}
                      </div>
                      <button type="submit">Invite</button>
                    </form>
                  </section>

                  {isCreator && detail.requests?.length > 0 && (
                    <section className={styles.panel}>
                      <h2>Join Requests</h2>
                      {detail.requests.map((request) => (
                        <div key={request.id} className={styles.requestRow}>
                          <span>{displayName(request.user)}</span>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleJoinRequest(request.user_id, "accepted")}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleJoinRequest(request.user_id, "declined")}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </section>
                  )}
                </aside>
              </div>
            ) : (
              <section className={styles.emptyState}>
                Join the group to view posts, comments, events, and members.
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function InviteSuggestions({ users, onSelect }) {
  return (
    <div className={styles.suggestions} role="listbox">
      {users.map((user) => {
        const nickname = user.nickname || "";
        return (
          <button
            key={user.id}
            type="button"
            role="option"
            aria-selected="false"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(nickname);
            }}
          >
            <strong>@{nickname}</strong>
            <span>{displayName(user)}</span>
          </button>
        );
      })}
    </div>
  );
}

function parseNicknames(value) {
  return value
    .split(",")
    .map(normalizeNickname)
    .filter(Boolean);
}

function normalizeNickname(value) {
  return value.trim().replace(/^@/, "");
}

function getMentionSuggestions(value, followers, allowCommaList) {
  const mention = getActiveMention(value, allowCommaList);
  if (!mention) return [];
  const query = mention.slice(1).toLowerCase();
  return followers.filter((user) => {
    const nickname = user.nickname || "";
    return nickname.toLowerCase().startsWith(query);
  });
}

function getActiveMention(value, allowCommaList) {
  const token = allowCommaList ? value.split(",").at(-1).trimStart() : value.trimStart();
  return token.startsWith("@") ? token : "";
}

function replaceMentionToken(value, nickname, allowCommaList) {
  const replacement = `@${nickname}`;
  if (!allowCommaList) return replacement;
  const parts = value.split(",");
  parts[parts.length - 1] = ` ${replacement}`;
  return `${parts.join(",").trimStart()}, `;
}

function displayName(user) {
  if (!user) return "Unknown user";
  return (
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    user.nickname ||
    "Unknown user"
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateTimeLocal(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

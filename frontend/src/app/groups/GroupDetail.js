"use client";

import {
  MaxCommentLen,
  MaxEventDescriptionLen,
  MaxEventTitleLen,
  MaxGroupInviteesLen,
  MaxGroupPostLen,
} from "@/lib/limits";
import { mediaUrl } from "@/lib/api";
import styles from "./Groups.module.css";
import { displayName, formatDate, InviteSuggestions, Avatar } from "./groupHelpers";

export default function GroupDetail({
  selectedGroup,
  detail,
  isMember,
  isCreator,
  drafts,
  postImage,
  commentDrafts,
  commentImages,
  expandedPosts,
  activeInviteField,
  memberInviteSuggestions,
  minEventTime,
  onDraftChange,
  onCreatePost,
  onToggleComments,
  onCreateComment,
  onCreateEvent,
  onEventResponse,
  onInvite,
  onJoinRequest,
  onFocusInviteField,
  onSelectMemberInvite,
  onCommentDraftChange,
  onPostImageChange,
  onCommentImageChange,
}) {
  if (!selectedGroup) {
    return <section className={styles.emptyState}>Select or create a group.</section>;
  }

  return (
    <main className={styles.groupMain}>
      <section className={`${styles.panel} ${styles.groupHero}`}>
        <div className={styles.groupHeader}>
          <div>
            <h1>{selectedGroup.title}</h1>
            <p>{selectedGroup.description || "No description."}</p>
            <span>
              Created by {displayName(selectedGroup.creator)} · {selectedGroup.member_count} members
            </span>
          </div>
          {!isMember && (
            <button
              type="button"
              disabled={selectedGroup.has_request}
              onClick={() => onJoinRequest(selectedGroup.id, "requested")}
            >
              {selectedGroup.has_request ? "Requested" : "Request to join"}
            </button>
          )}
        </div>
      </section>

      {isMember ? (
        <div className={styles.contentGrid}>
          <section className={`${styles.panel} ${styles.postsPanel}`}>
            <h2>Group Feed</h2>
            <form className={styles.composer} onSubmit={onCreatePost}>
              <textarea
                value={drafts.post}
                onChange={(event) => onDraftChange("post", event.target.value)}
                placeholder="Share with this group"
                rows={3}
                maxLength={MaxGroupPostLen}
              />
              <div className={styles.composerActions}>
                <label className={styles.fileButton}>
                  Image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(event) => onPostImageChange(event.target.files?.[0] || null)}
                  />
                </label>
                {postImage && <span className={styles.fileName}>{postImage.name}</span>}
              </div>
              <button type="submit">Post</button>
            </form>
            <div className={styles.postList}>
              {(detail.posts || []).map((post) => (
                <article key={post.id} className={styles.post}>
                  <header>
                    <div className={styles.authorRow}>
                      <Avatar user={post.author} />
                      <strong>{displayName(post.author)}</strong>
                    </div>
                    <span>{formatDate(post.created_at)}</span>
                  </header>
                  <p>{post.content}</p>
                  {post.image && (
                    <img className={styles.postImage} src={mediaUrl(post.image)} alt="" />
                  )}
                  <button type="button" onClick={() => onToggleComments(post.id)}>
                    {expandedPosts[post.id] ? "Hide comments" : "View comments"}
                  </button>
                  {expandedPosts[post.id] && (
                    <div className={styles.comments}>
                      {(expandedPosts[post.id] || []).map((comment) => (
                        <div key={comment.id} className={styles.comment}>
                          <Avatar user={comment.author} size="small" />
                          <div>
                            <strong>{displayName(comment.author)}</strong>
                            <span>{comment.content}</span>
                            {comment.image && (
                              <img
                                className={styles.commentImage}
                                src={mediaUrl(comment.image)}
                                alt=""
                              />
                            )}
                          </div>
                        </div>
                      ))}
                      <form onSubmit={(event) => onCreateComment(event, post.id)}>
                        <input
                          value={commentDrafts[post.id] || ""}
                          onChange={(event) => onCommentDraftChange(post.id, event.target.value)}
                          placeholder="Write a comment"
                          maxLength={MaxCommentLen}
                        />
                        <label className={styles.fileButton}>
                          Image
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={(event) =>
                              onCommentImageChange(post.id, event.target.files?.[0] || null)
                            }
                          />
                        </label>
                        <button type="submit">Send</button>
                        {commentImages[post.id] && (
                          <p className={styles.fileName}>{commentImages[post.id].name}</p>
                        )}
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
              <form className={styles.stackForm} onSubmit={onCreateEvent}>
                <input
                  value={drafts.eventTitle}
                  onChange={(event) => onDraftChange("eventTitle", event.target.value)}
                  placeholder="Title"
                  maxLength={MaxEventTitleLen}
                />
                <textarea
                  value={drafts.eventDescription}
                  onChange={(event) => onDraftChange("eventDescription", event.target.value)}
                  placeholder="Description"
                  rows={2}
                  maxLength={MaxEventDescriptionLen}
                />
                <input
                  type="datetime-local"
                  value={drafts.eventTime}
                  min={minEventTime}
                  onChange={(event) => onDraftChange("eventTime", event.target.value)}
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
                        onClick={() => onEventResponse(event.id, "going")}
                      >
                        Going {event.going_count}
                      </button>
                      <button
                        type="button"
                        className={event.my_response === "not_going" ? styles.selected : ""}
                        onClick={() => onEventResponse(event.id, "not_going")}
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
              <form className={styles.inlineForm} onSubmit={onInvite}>
                <div className={styles.suggestField}>
                  <input
                    value={drafts.inviteUser}
                    onFocus={() => onFocusInviteField("member", "inviteUser")}
                    onBlur={() => setTimeout(() => onFocusInviteField("", ""), 120)}
                    onChange={(event) => {
                      onDraftChange("inviteUser", event.target.value);
                      onSelectMemberInvite(null);
                    }}
                    placeholder="First Last"
                    maxLength={MaxGroupInviteesLen}
                  />
                  {activeInviteField === "member" && memberInviteSuggestions.length > 0 && (
                    <InviteSuggestions users={memberInviteSuggestions} onSelect={onSelectMemberInvite} />
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
                        onClick={() => onJoinRequest(request.user_id, "accepted")}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => onJoinRequest(request.user_id, "declined")}
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
    </main>
  );
}

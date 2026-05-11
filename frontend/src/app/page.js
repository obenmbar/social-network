"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  createComment,
  createPost,
  getCurrentUser,
  getFeed,
  getFollowers,
  getPost,
  mediaUrl,
} from "@/lib/api";
import styles from "./Feed.module.css";

const privacyOptions = [
  { value: "public", label: "Public" },
  { value: "followers", label: "Followers" },
  { value: "private_selected", label: "Selected" },
];

export default function Feed() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [mentionInput, setMentionInput] = useState("@");
  const [selectedFollowerIds, setSelectedFollowerIds] = useState([]);
  const [image, setImage] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentImages, setCommentImages] = useState({});
  const [postingComments, setPostingComments] = useState({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getCurrentUser(), getFeed(), getFollowers()])
      .then(([currentUser, feed, followerList]) => {
        if (isMounted) {
          setUser(currentUser);
          setPosts(feed);
          setFollowers(followerList || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err instanceof ApiError && err.status === 401) {
            router.replace("/login");
          } else {
            setError(err.message || "Could not load feed");
          }
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const allowedUserIds = useMemo(() => {
    return privacy === "private_selected" ? selectedFollowerIds : [];
  }, [privacy, selectedFollowerIds]);

  const selectedFollowers = useMemo(() => {
    const selected = new Set(selectedFollowerIds);
    return followers.filter((follower) => selected.has(follower.id));
  }, [followers, selectedFollowerIds]);

  const mentionQuery = mentionInput.replace(/^@/, "").trim().toLowerCase();
  const suggestedFollowers = useMemo(() => {
    const selected = new Set(selectedFollowerIds);
    return followers
      .filter((follower) => !selected.has(follower.id))
      .filter((follower) => {
        if (!mentionQuery) {
          return true;
        }
        return (
          displayName(follower).toLowerCase().includes(mentionQuery) ||
          mentionHandle(follower).toLowerCase().includes(mentionQuery)
        );
      });
  }, [followers, mentionQuery, selectedFollowerIds]);

  const handleCreatePost = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setIsPosting(true);

    try {
      const post = await createPost({
        title,
        content,
        privacy,
        allowedUserIds,
        image,
      });

      setPosts((currentPosts) => [post, ...currentPosts]);
      setTitle("");
      setContent("");
      setPrivacy("public");
      setMentionInput("@");
      setSelectedFollowerIds([]);
      setImage(null);
      form.reset();
    } catch (err) {
      setError(err.message || "Could not create post");
    } finally {
      setIsPosting(false);
    }
  };

  const handleMentionInputChange = (event) => {
    const value = event.target.value;
    setMentionInput(value.startsWith("@") ? value : `@${value}`);
  };

  const handleSelectFollower = (followerId) => {
    setSelectedFollowerIds((current) =>
      current.includes(followerId) ? current : [...current, followerId]
    );
    setMentionInput("@");
  };

  const handleRemoveFollower = (followerId) => {
    setSelectedFollowerIds((current) => current.filter((id) => id !== followerId));
  };

  const handleToggleComments = async (postId) => {
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
      const detail = await getPost(postId);
      setExpandedPosts((current) => ({
        ...current,
        [postId]: detail.comments || [],
      }));
    } catch (err) {
      setError(err.message || "Could not load comments");
    }
  };

  const handleCreateComment = async (event, postId) => {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setPostingComments((current) => ({ ...current, [postId]: true }));

    try {
      const comment = await createComment(postId, {
        content: commentDrafts[postId] || "",
        image: commentImages[postId] || null,
      });

      setExpandedPosts((current) => ({
        ...current,
        [postId]: [...(current[postId] || []), comment],
      }));
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      setCommentImages((current) => ({ ...current, [postId]: null }));
      form.reset();
    } catch (err) {
      setError(err.message || "Could not add comment");
    } finally {
      setPostingComments((current) => ({ ...current, [postId]: false }));
    }
  };

  return (
    <div className={styles.feedContainer}>
      <main className={styles.mainContent}>
        <section className={styles.welcomeSection}>
          <div>
            <h2>Welcome{user?.first_name ? `, ${user.first_name}` : ""}</h2>
            <p>Share an update or catch up with posts you can see.</p>
          </div>
        </section>

        <form className={styles.composer} onSubmit={handleCreatePost}>
          <div className={styles.composerHeader}>
            <Avatar user={user} />
            <div className={styles.composerFields}>
              <label className={styles.srOnly} htmlFor="post-title">
                Post title
              </label>
              <input
                id="post-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Post title"
                maxLength={120}
              />
              <label className={styles.srOnly} htmlFor="post-content">
                Post content
              </label>
              <textarea
                id="post-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="What would you like to share?"
                rows={3}
              />
            </div>
          </div>

          {privacy === "private_selected" && (
            <div className={styles.mentionPicker}>
              <label htmlFor="selected-followers">Tag followers</label>
              <div className={styles.mentionInputWrap}>
                {selectedFollowers.map((follower) => (
                  <button
                    key={follower.id}
                    type="button"
                    className={styles.mentionChip}
                    onClick={() => handleRemoveFollower(follower.id)}
                    aria-label={`Remove ${displayName(follower)}`}
                  >
                    @{mentionHandle(follower)}
                  </button>
                ))}
                <input
                  id="selected-followers"
                  type="text"
                  value={mentionInput}
                  onChange={handleMentionInputChange}
                  placeholder="@username"
                  autoComplete="off"
                />
              </div>

              <div className={styles.followerList}>
                {suggestedFollowers.length === 0 ? (
                  <p>
                    {followers.length === 0
                      ? "No followers yet."
                      : "No matching followers."}
                  </p>
                ) : (
                  suggestedFollowers.map((follower) => (
                    <button
                      key={follower.id}
                      type="button"
                      onClick={() => handleSelectFollower(follower.id)}
                    >
                      <Avatar user={follower} size="small" />
                      <span>
                        <strong>{displayName(follower)}</strong>
                        <small>@{mentionHandle(follower)}</small>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className={styles.composerActions}>
            <div className={styles.segmentedControl} aria-label="Post privacy">
              {privacyOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={privacy === option.value ? styles.activeSegment : ""}
                  onClick={() => setPrivacy(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className={styles.fileButton}>
              Image
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(event) => setImage(event.target.files?.[0] || null)}
              />
            </label>

            <button type="submit" className={styles.primaryButton} disabled={isPosting}>
              {isPosting ? "Posting..." : "Post"}
            </button>
          </div>

          {image && <p className={styles.fileName}>{image.name}</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}
        </form>

        <section className={styles.postsSection}>
          {isLoading ? (
            <>
              <PostPlaceholder />
              <PostPlaceholder />
            </>
          ) : posts.length === 0 ? (
            <div className={styles.emptyState}>No posts are visible yet.</div>
          ) : (
            posts.map((post) => (
              <article key={post.id} className={styles.postCard}>
                <header className={styles.postHeader}>
                  <Avatar user={post.author} />
                  <div>
                    <h3>{displayName(post.author)}</h3>
                    <p>
                      {formatDate(post.created_at)} · {privacyLabel(post.privacy)}
                    </p>
                  </div>
                </header>

                {post.title && <h2 className={styles.postTitle}>{post.title}</h2>}
                {post.content && <p className={styles.postContent}>{post.content}</p>}
                {post.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.postImage}
                    src={mediaUrl(post.image)}
                    alt=""
                  />
                )}

                <div className={styles.postActions}>
                  <button type="button" onClick={() => handleToggleComments(post.id)}>
                    {expandedPosts[post.id] ? "Hide comments" : "View comments"}
                  </button>
                </div>

                {expandedPosts[post.id] && (
                  <div className={styles.comments}>
                    {expandedPosts[post.id].length === 0 ? (
                      <p className={styles.emptyComments}>No comments yet.</p>
                    ) : (
                      expandedPosts[post.id].map((comment) => (
                        <Comment key={comment.id} comment={comment} />
                      ))
                    )}

                    <form
                      className={styles.commentForm}
                      onSubmit={(event) => handleCreateComment(event, post.id)}
                    >
                      <input
                        type="text"
                        value={commentDrafts[post.id] || ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [post.id]: event.target.value,
                          }))
                        }
                        placeholder="Write a comment"
                      />
                      <label className={styles.commentFileButton}>
                        Image
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={(event) =>
                            setCommentImages((current) => ({
                              ...current,
                              [post.id]: event.target.files?.[0] || null,
                            }))
                          }
                        />
                      </label>
                      <button type="submit" disabled={postingComments[post.id]}>
                        {postingComments[post.id] ? "Sending..." : "Send"}
                      </button>
                      {commentImages[post.id] && (
                        <p className={styles.commentFileName}>
                          {commentImages[post.id].name}
                        </p>
                      )}
                    </form>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

function Comment({ comment }) {
  return (
    <div className={styles.comment}>
      <Avatar user={comment.author} size="small" />
      <div className={styles.commentBody}>
        <strong>{displayName(comment.author)}</strong>
        {comment.content && <p>{comment.content}</p>}
        {comment.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(comment.image)} alt="" />
        )}
      </div>
    </div>
  );
}

function Avatar({ user, size = "default" }) {
  const initial = user?.first_name?.trim()?.charAt(0)?.toUpperCase() || "?";
  const className = size === "small" ? styles.avatarSmall : styles.avatar;

  return (
    <div className={className}>
      {user?.avatar ? (
        <span
          className={styles.avatarImage}
          style={{ backgroundImage: `url(${mediaUrl(user.avatar)})` }}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function PostPlaceholder() {
  return (
    <div className={styles.postPlaceholder}>
      <div className={styles.avatarPlaceholder}></div>
      <div className={styles.contentPlaceholder}>
        <div className={styles.linePlaceholder}></div>
        <div className={styles.linePlaceholder}></div>
        <div className={styles.linePlaceholderShort}></div>
      </div>
    </div>
  );
}

function displayName(user) {
  if (!user) {
    return "Unknown user";
  }

  return (
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    user.nickname ||
    "Unknown user"
  );
}

function mentionHandle(user) {
  const nickname = user?.nickname?.trim();
  if (nickname) {
    return nickname.replace(/^@+/, "");
  }

  const fallback = displayName(user)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  return fallback || "user";
}

function privacyLabel(privacy) {
  const option = privacyOptions.find((item) => item.value === privacy);
  return option?.label || "Public";
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

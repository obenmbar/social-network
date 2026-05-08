"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createComment,
  createPost,
  getCurrentUser,
  getFeed,
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
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [allowedUsers, setAllowedUsers] = useState("");
  const [image, setImage] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentImages, setCommentImages] = useState({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getCurrentUser(), getFeed()])
      .then(([currentUser, feed]) => {
        if (isMounted) {
          setUser(currentUser);
          setPosts(feed);
        }
      })
      .catch(() => {
        if (isMounted) {
          router.replace("/login");
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
    return allowedUsers
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [allowedUsers]);

  const handleCreatePost = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setIsPosting(true);

    try {
      const post = await createPost({
        content,
        privacy,
        allowedUserIds,
        image,
      });

      setPosts((currentPosts) => [post, ...currentPosts]);
      setContent("");
      setPrivacy("public");
      setAllowedUsers("");
      setImage(null);
      form.reset();
    } catch (err) {
      setError(err.message || "Could not create post");
    } finally {
      setIsPosting(false);
    }
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

          {privacy === "private_selected" && (
            <label className={styles.selectedUsers}>
              Selected follower IDs
              <input
                type="text"
                value={allowedUsers}
                onChange={(event) => setAllowedUsers(event.target.value)}
                placeholder="user-id-1, user-id-2"
              />
            </label>
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
                accept="image/jpeg,image/png,image/gif"
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
                          accept="image/jpeg,image/png,image/gif"
                          onChange={(event) =>
                            setCommentImages((current) => ({
                              ...current,
                              [post.id]: event.target.files?.[0] || null,
                            }))
                          }
                        />
                      </label>
                      <button type="submit">Send</button>
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

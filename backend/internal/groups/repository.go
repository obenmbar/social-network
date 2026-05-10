package groups

import (
	"database/sql"
	"fmt"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateGroup(group *Group, inviteeIDs []string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`INSERT INTO groups (id, creator_id, title, description) VALUES (?, ?, ?, ?)`, group.ID, group.CreatorID, group.Title, group.Description); err != nil {
		return fmt.Errorf("failed to insert group: %w", err)
	}
	if _, err := tx.Exec(`INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`, group.ID, group.CreatorID, RoleCreator); err != nil {
		return fmt.Errorf("failed to insert creator membership: %w", err)
	}
	for _, userID := range inviteeIDs {
		if userID == group.CreatorID {
			continue
		}
		if _, err := tx.Exec(`INSERT OR IGNORE INTO group_invitations (group_id, inviter_id, invitee_id, status) VALUES (?, ?, ?, ?)`, group.ID, group.CreatorID, userID, InvitationPending); err != nil {
			return fmt.Errorf("failed to insert invitation: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit group: %w", err)
	}
	return nil
}

func (r *Repository) ListGroups(viewerID string) ([]*Group, error) {
	rows, err := r.db.Query(groupSelectSQL()+` ORDER BY g.created_at DESC`, viewerID, viewerID, viewerID)
	if err != nil {
		return nil, fmt.Errorf("failed to list groups: %w", err)
	}
	defer rows.Close()

	groups := []*Group{}
	for rows.Next() {
		group, err := scanGroup(rows)
		if err != nil {
			return nil, err
		}
		groups = append(groups, group)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read groups: %w", err)
	}
	return groups, nil
}

func (r *Repository) GetGroupByID(viewerID, groupID string) (*Group, error) {
	row := r.db.QueryRow(groupSelectSQL()+` WHERE g.id = ?`, viewerID, viewerID, viewerID, groupID)
	group, err := scanGroup(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return group, nil
}

func (r *Repository) IsMember(groupID, userID string) (bool, error) {
	var exists bool
	if err := r.db.QueryRow(`SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?)`, groupID, userID).Scan(&exists); err != nil {
		return false, fmt.Errorf("failed to check membership: %w", err)
	}
	return exists, nil
}

func (r *Repository) IsCreator(groupID, userID string) (bool, error) {
	var exists bool
	if err := r.db.QueryRow(`SELECT EXISTS (SELECT 1 FROM groups WHERE id = ? AND creator_id = ?)`, groupID, userID).Scan(&exists); err != nil {
		return false, fmt.Errorf("failed to check creator: %w", err)
	}
	return exists, nil
}

func (r *Repository) GetUserIDByNickname(nickname string) (string, error) {
	var userID string
	err := r.db.QueryRow(`SELECT id FROM users WHERE nickname = ?`, nickname).Scan(&userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", fmt.Errorf("failed to get user by nickname: %w", err)
	}
	return userID, nil
}

func (r *Repository) InviteUser(groupID, inviterID, inviteeID string) error {
	_, err := r.db.Exec(`INSERT OR IGNORE INTO group_invitations (group_id, inviter_id, invitee_id, status) VALUES (?, ?, ?, ?)`, groupID, inviterID, inviteeID, InvitationPending)
	if err != nil {
		return fmt.Errorf("failed to invite user: %w", err)
	}
	return nil
}

func (r *Repository) RespondToInvitation(groupID, userID, status string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.Exec(`UPDATE group_invitations SET status = ? WHERE group_id = ? AND invitee_id = ? AND status = ?`, status, groupID, userID, InvitationPending)
	if err != nil {
		return fmt.Errorf("failed to update invitation: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check invitation: %w", err)
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	if status == InvitationAccepted {
		if _, err := tx.Exec(`INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`, groupID, userID, RoleMember); err != nil {
			return fmt.Errorf("failed to add member: %w", err)
		}
	}
	return tx.Commit()
}

func (r *Repository) RequestToJoin(groupID, userID string) error {
	_, err := r.db.Exec(`INSERT OR IGNORE INTO group_join_requests (group_id, user_id, status) VALUES (?, ?, ?)`, groupID, userID, RequestPending)
	if err != nil {
		return fmt.Errorf("failed to request group: %w", err)
	}
	return nil
}

func (r *Repository) RespondToJoinRequest(groupID, requesterID, status string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	result, err := tx.Exec(`UPDATE group_join_requests SET status = ? WHERE group_id = ? AND user_id = ? AND status = ?`, status, groupID, requesterID, RequestPending)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check request: %w", err)
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	if status == RequestAccepted {
		if _, err := tx.Exec(`INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`, groupID, requesterID, RoleMember); err != nil {
			return fmt.Errorf("failed to add member: %w", err)
		}
	}
	return tx.Commit()
}

func (r *Repository) CreatePost(post *GroupPost) error {
	_, err := r.db.Exec(`INSERT INTO group_posts (id, group_id, user_id, content) VALUES (?, ?, ?, ?)`, post.ID, post.GroupID, post.UserID, post.Content)
	if err != nil {
		return fmt.Errorf("failed to create group post: %w", err)
	}
	return nil
}

func (r *Repository) GetPostByID(postID string) (*GroupPost, error) {
	row := r.db.QueryRow(`
		SELECT gp.id, gp.group_id, gp.user_id, gp.content, gp.created_at,
		       u.id, u.first_name, u.last_name, u.nickname, u.avatar
		FROM group_posts gp
		JOIN users u ON u.id = gp.user_id
		WHERE gp.id = ?`, postID)
	post, err := scanPost(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return post, nil
}

func (r *Repository) GetPosts(groupID string) ([]*GroupPost, error) {
	rows, err := r.db.Query(`
		SELECT gp.id, gp.group_id, gp.user_id, gp.content, gp.created_at,
		       u.id, u.first_name, u.last_name, u.nickname, u.avatar
		FROM group_posts gp
		JOIN users u ON u.id = gp.user_id
		WHERE gp.group_id = ?
		ORDER BY gp.created_at DESC`, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group posts: %w", err)
	}
	defer rows.Close()

	posts := []*GroupPost{}
	for rows.Next() {
		post, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		posts = append(posts, post)
	}
	return posts, rows.Err()
}

func (r *Repository) CreateComment(comment *GroupComment) error {
	_, err := r.db.Exec(`INSERT INTO group_comments (id, post_id, user_id, content) VALUES (?, ?, ?, ?)`, comment.ID, comment.PostID, comment.UserID, comment.Content)
	if err != nil {
		return fmt.Errorf("failed to create group comment: %w", err)
	}
	return nil
}

func (r *Repository) GetCommentByID(commentID string) (*GroupComment, error) {
	row := r.db.QueryRow(`
		SELECT gc.id, gc.post_id, gc.user_id, gc.content, gc.created_at,
		       u.id, u.first_name, u.last_name, u.nickname, u.avatar
		FROM group_comments gc
		JOIN users u ON u.id = gc.user_id
		WHERE gc.id = ?`, commentID)
	comment, err := scanComment(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return comment, nil
}

func (r *Repository) GetComments(postID string) ([]*GroupComment, error) {
	rows, err := r.db.Query(`
		SELECT gc.id, gc.post_id, gc.user_id, gc.content, gc.created_at,
		       u.id, u.first_name, u.last_name, u.nickname, u.avatar
		FROM group_comments gc
		JOIN users u ON u.id = gc.user_id
		WHERE gc.post_id = ?
		ORDER BY gc.created_at ASC`, postID)
	if err != nil {
		return nil, fmt.Errorf("failed to get comments: %w", err)
	}
	defer rows.Close()

	comments := []*GroupComment{}
	for rows.Next() {
		comment, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		comments = append(comments, comment)
	}
	return comments, rows.Err()
}

func (r *Repository) CreateEvent(event *GroupEvent) error {
	_, err := r.db.Exec(`INSERT INTO group_events (id, group_id, creator_id, title, description, event_time) VALUES (?, ?, ?, ?, ?, ?)`, event.ID, event.GroupID, event.CreatorID, event.Title, event.Description, event.EventTime)
	if err != nil {
		return fmt.Errorf("failed to create event: %w", err)
	}
	return nil
}

func (r *Repository) RespondToEvent(eventID, userID, response string) error {
	_, err := r.db.Exec(`
		INSERT INTO group_event_responses (event_id, user_id, response) VALUES (?, ?, ?)
		ON CONFLICT(event_id, user_id) DO UPDATE SET response = excluded.response, created_at = CURRENT_TIMESTAMP`, eventID, userID, response)
	if err != nil {
		return fmt.Errorf("failed to respond to event: %w", err)
	}
	return nil
}

func (r *Repository) GetEvents(groupID, viewerID string) ([]*GroupEvent, error) {
	rows, err := r.db.Query(`
		SELECT ge.id, ge.group_id, ge.creator_id, ge.title, ge.description, ge.event_time, ge.created_at,
		       u.id, u.first_name, u.last_name, u.nickname, u.avatar,
		       my.response,
		       COUNT(CASE WHEN all_responses.response = 'going' THEN 1 END) AS going_count,
		       COUNT(CASE WHEN all_responses.response = 'not_going' THEN 1 END) AS not_going_count
		FROM group_events ge
		JOIN users u ON u.id = ge.creator_id
		LEFT JOIN group_event_responses my ON my.event_id = ge.id AND my.user_id = ?
		LEFT JOIN group_event_responses all_responses ON all_responses.event_id = ge.id
		WHERE ge.group_id = ?
		GROUP BY ge.id
		ORDER BY ge.event_time ASC`, viewerID, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get events: %w", err)
	}
	defer rows.Close()

	events := []*GroupEvent{}
	for rows.Next() {
		event := &GroupEvent{}
		if err := rows.Scan(
			&event.ID, &event.GroupID, &event.CreatorID, &event.Title, &event.Description, &event.EventTime, &event.CreatedAt,
			&event.Creator.ID, &event.Creator.FirstName, &event.Creator.LastName, &event.Creator.Nickname, &event.Creator.Avatar,
			&event.MyResponse, &event.GoingCount, &event.NotGoingCount,
		); err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (r *Repository) GetMembers(groupID string) ([]Author, error) {
	rows, err := r.db.Query(`
		SELECT u.id, u.first_name, u.last_name, u.nickname, u.avatar
		FROM group_members gm
		JOIN users u ON u.id = gm.user_id
		WHERE gm.group_id = ?
		ORDER BY gm.created_at ASC`, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get members: %w", err)
	}
	defer rows.Close()

	members := []Author{}
	for rows.Next() {
		var member Author
		if err := rows.Scan(&member.ID, &member.FirstName, &member.LastName, &member.Nickname, &member.Avatar); err != nil {
			return nil, fmt.Errorf("failed to scan member: %w", err)
		}
		members = append(members, member)
	}
	return members, rows.Err()
}

func (r *Repository) GetPendingRequests(groupID string) ([]*JoinRequest, error) {
	rows, err := r.db.Query(`
		SELECT gr.id, gr.group_id, gr.user_id, gr.status, gr.created_at,
		       u.id, u.first_name, u.last_name, u.nickname, u.avatar
		FROM group_join_requests gr
		JOIN users u ON u.id = gr.user_id
		WHERE gr.group_id = ? AND gr.status = ?
		ORDER BY gr.created_at ASC`, groupID, RequestPending)
	if err != nil {
		return nil, fmt.Errorf("failed to get join requests: %w", err)
	}
	defer rows.Close()

	requests := []*JoinRequest{}
	for rows.Next() {
		req := &JoinRequest{}
		if err := rows.Scan(&req.ID, &req.GroupID, &req.UserID, &req.Status, &req.CreatedAt, &req.User.ID, &req.User.FirstName, &req.User.LastName, &req.User.Nickname, &req.User.Avatar); err != nil {
			return nil, fmt.Errorf("failed to scan request: %w", err)
		}
		requests = append(requests, req)
	}
	return requests, rows.Err()
}

func (r *Repository) GetInvitations(userID string) ([]*Invitation, error) {
	rows, err := r.db.Query(`
		SELECT gi.id, gi.group_id, gi.inviter_id, gi.invitee_id, gi.status, gi.created_at,
		       g.id, g.creator_id, g.title, g.description, g.created_at,
		       u.id, u.first_name, u.last_name, u.nickname, u.avatar
		FROM group_invitations gi
		JOIN groups g ON g.id = gi.group_id
		JOIN users u ON u.id = g.creator_id
		WHERE gi.invitee_id = ? AND gi.status = ?
		ORDER BY gi.created_at DESC`, userID, InvitationPending)
	if err != nil {
		return nil, fmt.Errorf("failed to get invitations: %w", err)
	}
	defer rows.Close()

	invitations := []*Invitation{}
	for rows.Next() {
		invitation := &Invitation{}
		if err := rows.Scan(
			&invitation.ID, &invitation.GroupID, &invitation.InviterID, &invitation.InviteeID, &invitation.Status, &invitation.CreatedAt,
			&invitation.Group.ID, &invitation.Group.CreatorID, &invitation.Group.Title, &invitation.Group.Description, &invitation.Group.CreatedAt,
			&invitation.Group.Creator.ID, &invitation.Group.Creator.FirstName, &invitation.Group.Creator.LastName, &invitation.Group.Creator.Nickname, &invitation.Group.Creator.Avatar,
		); err != nil {
			return nil, fmt.Errorf("failed to scan invitation: %w", err)
		}
		invitations = append(invitations, invitation)
	}
	return invitations, rows.Err()
}

func groupSelectSQL() string {
	return `
		SELECT g.id, g.creator_id, g.title, g.description, g.created_at,
		       u.id, u.first_name, u.last_name, u.nickname, u.avatar,
		       (SELECT COUNT(*) FROM group_members gm_count WHERE gm_count.group_id = g.id) AS member_count,
		       EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) AS is_member,
		       EXISTS (SELECT 1 FROM group_join_requests gr WHERE gr.group_id = g.id AND gr.user_id = ? AND gr.status = 'pending') AS has_request,
		       EXISTS (SELECT 1 FROM group_invitations gi WHERE gi.group_id = g.id AND gi.invitee_id = ? AND gi.status = 'pending') AS has_invite
		FROM groups g
		JOIN users u ON u.id = g.creator_id`
}

type scanner interface {
	Scan(dest ...any) error
}

func scanGroup(row scanner) (*Group, error) {
	group := &Group{}
	if err := row.Scan(
		&group.ID, &group.CreatorID, &group.Title, &group.Description, &group.CreatedAt,
		&group.Creator.ID, &group.Creator.FirstName, &group.Creator.LastName, &group.Creator.Nickname, &group.Creator.Avatar,
		&group.MemberCount, &group.IsMember, &group.HasRequest, &group.HasInvite,
	); err != nil {
		return nil, err
	}
	return group, nil
}

func scanPost(row scanner) (*GroupPost, error) {
	post := &GroupPost{}
	if err := row.Scan(
		&post.ID, &post.GroupID, &post.UserID, &post.Content, &post.CreatedAt,
		&post.Author.ID, &post.Author.FirstName, &post.Author.LastName, &post.Author.Nickname, &post.Author.Avatar,
	); err != nil {
		return nil, err
	}
	return post, nil
}

func scanComment(row scanner) (*GroupComment, error) {
	comment := &GroupComment{}
	if err := row.Scan(
		&comment.ID, &comment.PostID, &comment.UserID, &comment.Content, &comment.CreatedAt,
		&comment.Author.ID, &comment.Author.FirstName, &comment.Author.LastName, &comment.Author.Nickname, &comment.Author.Avatar,
	); err != nil {
		return nil, err
	}
	return comment, nil
}
